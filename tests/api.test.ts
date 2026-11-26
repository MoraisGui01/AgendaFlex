import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import request from 'supertest';
import { criarApi } from '../server/app.ts';
import { abrirBancoMemoria, paraParametrosPostgres } from '../server/banco/conexao.ts';
import { criarEsquema } from '../server/banco/esquema.ts';
import { popularSeVazio } from '../server/banco/semente.ts';

// Testes da API com banco SQLite em memória e um usuário fixo no lugar do login Google

let app: ReturnType<typeof criarApi>;

// Próxima quinta-feira (dia útil em que todos os locais abrem)
function proximaQuinta(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const DIA = proximaQuinta();

before(async () => {
  const banco = await abrirBancoMemoria();
  await criarEsquema(banco);
  await popularSeVazio(banco);
  app = criarApi(banco, (req, _res, next) => {
    req.usuario = { uid: 'teste', email: 'teste@exemplo.com', nome: 'Usuário de Teste' };
    next();
  });
});

describe('API do AgendaFlex', () => {
  it('converte parâmetros para o PostgreSQL ignorando textos', () => {
    assert.equal(paraParametrosPostgres("SELECT * FROM t WHERE a = ? AND b = '?' AND c = ?"), "SELECT * FROM t WHERE a = $1 AND b = '?' AND c = $2");
  });

  it('cria, edita e arquiva um procedimento', async () => {
    const criado = await request(app).post('/api/procedimentos').send({ nome: 'Avaliação Postural', duracao_min: 40, valor: 200 }).expect(201);
    assert.equal(criado.body.status, 'ativo');

    // Editar só o valor não pode reativar nem mudar outros campos
    await request(app).put(`/api/procedimentos/${criado.body.id}`).send({ status: 'inativo' }).expect(200);
    const editado = await request(app).put(`/api/procedimentos/${criado.body.id}`).send({ valor: 250 }).expect(200);
    assert.equal(editado.body.valor, 250);
    assert.equal(editado.body.status, 'inativo');
    assert.equal(editado.body.duracao_min, 40);

    await request(app).delete(`/api/procedimentos/${criado.body.id}`).expect(200);
    const lista = await request(app).get('/api/procedimentos').expect(200);
    assert.ok(!lista.body.some((p: { id: string }) => p.id === criado.body.id));
  });

  it('valida os dados enviados', async () => {
    const resposta = await request(app).post('/api/clientes').send({ nome: 'A', whatsapp: '1', nascimento: '2026-02-30' }).expect(400);
    assert.ok(resposta.body.error);
  });

  it('oferece horários livres e impede choque de horário', async () => {
    const consulta = { profissional_id: 'prof-diego', local_id: 'loc-centro-02', procedimento_id: 'proc-retorno', data: DIA };
    const livres = await request(app).get('/api/disponibilidade').query(consulta).expect(200);
    assert.ok(livres.body.slots.length > 0);
    const primeiro = livres.body.slots.at(-1).data_hora_inicio;

    const novo = { cliente_id: 'cli-01', profissional_id: 'prof-diego', local_id: 'loc-centro-02', procedimento_id: 'proc-retorno', data_hora_inicio: primeiro };
    await request(app).post('/api/agendamentos').send(novo).expect(201);

    // Mesmo profissional no mesmo horário, outro local
    const choque = await request(app).post('/api/agendamentos').send({ ...novo, cliente_id: 'cli-02', local_id: 'loc-centro-01' }).expect(409);
    assert.match(choque.body.error, /profissional/);

    const depois = await request(app).get('/api/disponibilidade').query(consulta).expect(200);
    assert.ok(!depois.body.slots.some((s: { data_hora_inicio: string }) => s.data_hora_inicio === primeiro));
  });

  it('recusa horário fora do expediente e procedimento não vinculado', async () => {
    const base = { cliente_id: 'cli-03', profissional_id: 'prof-diego', local_id: 'loc-centro-02', procedimento_id: 'proc-retorno' };
    const cedo = await request(app).post('/api/agendamentos').send({ ...base, data_hora_inicio: `${DIA}T07:00` }).expect(409);
    assert.match(cedo.body.error, /expediente/);

    await request(app)
      .post('/api/agendamentos')
      .send({ ...base, profissional_id: 'prof-carla', procedimento_id: 'proc-laser', data_hora_inicio: `${DIA}T09:00` })
      .expect(400);
  });

  it('soma procedimento extra ao valor e à duração', async () => {
    const criado = await request(app)
      .post('/api/agendamentos')
      .send({ cliente_id: 'cli-04', profissional_id: 'prof-diego', local_id: 'loc-centro-01', procedimento_id: 'proc-curativo', data_hora_inicio: `${DIA}T17:00` })
      .expect(201);
    const extra = await request(app)
      .post(`/api/agendamentos/${criado.body.id}/extras`)
      .send({ nome_procedimento: 'Curativo adicional', duracao_min: 15, valor: 60 })
      .expect(201);
    assert.equal(extra.body.duracao_total_min, 45);
    assert.equal(extra.body.data_hora_fim, `${DIA}T17:45:00`);

    await request(app).patch(`/api/agendamentos/${criado.body.id}/status`).send({ status: 'realizado' }).expect(200);
  });

  it('cancelamento pelo WhatsApp libera o horário', async () => {
    const lista = await request(app).get('/api/agendamentos').query({ data: DIA }).expect(200);
    const alvo = lista.body.find((a: { status: string }) => a.status === 'agendado');
    const resposta = await request(app).post('/api/whatsapp/simular').send({ agendamento_id: alvo.id, novo_estado: 'Cancelado' }).expect(200);
    assert.equal(resposta.body.status, 'cancelado');
  });

  it('gera relatório e registra auditoria', async () => {
    const relatorio = await request(app).get('/api/relatorios').query({ from: '2000-01-01', to: '2099-12-31' }).expect(200);
    assert.ok(relatorio.body.resumo.total_agendamentos > 0);
    const logs = await request(app).get('/api/logs-auditoria').expect(200);
    assert.ok(logs.body.some((l: { acao: string }) => l.acao === 'CRIACAO_AGENDAMENTO'));
  });
});
