import crypto from 'node:crypto';
import { CLINICA_ID } from '../config.ts';
import { diaDaSemana, montarDataHora, paraMinutos } from '../horarios.ts';
import type { Banco } from './conexao.ts';

/**
 * Dados de demonstração, criados apenas quando o banco está vazio.
 * As datas dos agendamentos são relativas ao dia de hoje para a agenda nunca aparecer vazia.
 */

const LOCAIS = [
  {
    id: 'loc-centro-01',
    nome: 'Unidade Centro · Consultório 1',
    endereco: 'Rua 9, 1.250 - Sala 304, Setor Oeste, Goiânia - GO',
    horario: { abertura: '08:00', fechamento: '18:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', dias: [1, 2, 3, 4, 5] },
  },
  {
    id: 'loc-centro-02',
    nome: 'Unidade Centro · Consultório 2',
    endereco: 'Rua 9, 1.250 - Sala 306, Setor Oeste, Goiânia - GO',
    horario: { abertura: '09:00', fechamento: '17:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', dias: [1, 2, 3, 4, 5] },
  },
  {
    id: 'loc-centro-proc',
    nome: 'Unidade Centro · Sala de Procedimentos',
    endereco: 'Rua 9, 1.250 - Sala 310, Setor Oeste, Goiânia - GO',
    horario: { abertura: '08:00', fechamento: '19:00', intervalo_inicio: '12:30', intervalo_fim: '13:30', dias: [1, 2, 3, 4, 5, 6] },
  },
];

const PROCEDIMENTOS = [
  { id: 'proc-consulta-derm', nome: 'Consulta Dermatológica', duracao_min: 45, valor: 350, orientacoes: 'Vir sem maquiagem e sem ácidos no rosto nas 24 horas anteriores.' },
  { id: 'proc-cardio-ecg', nome: 'Consulta Cardiológica com ECG', duracao_min: 60, valor: 480, orientacoes: 'Trazer exames recentes e a lista de medicamentos em uso.' },
  { id: 'proc-fisio', nome: 'Sessão de Fisioterapia', duracao_min: 45, valor: 190, orientacoes: 'Usar roupas leves que permitam movimentar as articulações.' },
  { id: 'proc-retorno', nome: 'Retorno com Resultado de Exames', duracao_min: 30, valor: 0, orientacoes: 'Trazer os laudos originais pedidos na primeira consulta.' },
  { id: 'proc-laser', nome: 'Sessão de Laser', duracao_min: 30, valor: 290, orientacoes: 'Evitar sol direto nas 72 horas antes e depois da sessão.' },
  { id: 'proc-curativo', nome: 'Curativo / Pequeno Procedimento', duracao_min: 30, valor: 150, orientacoes: 'Informar alergias a medicamentos e uso de anticoagulantes.' },
];

const PROFISSIONAIS = [
  { id: 'prof-ana', nome: 'Dra. Ana Beatriz Rocha', cpf: '529.982.247-25', registro_conselho: 'CRM-GO 21.457', especialidade: 'Dermatologia', procedimentos: ['proc-consulta-derm', 'proc-retorno', 'proc-laser', 'proc-curativo'] },
  { id: 'prof-bruno', nome: 'Dr. Bruno Teixeira', cpf: '153.509.460-56', registro_conselho: 'CRM-GO 18.932', especialidade: 'Cardiologia', procedimentos: ['proc-cardio-ecg', 'proc-retorno'] },
  { id: 'prof-carla', nome: 'Carla Mendonça', cpf: '714.602.380-01', registro_conselho: 'CREFITO-11 98.114-F', especialidade: 'Fisioterapia', procedimentos: ['proc-fisio'] },
  { id: 'prof-diego', nome: 'Dr. Diego Alves', cpf: '048.377.910-40', registro_conselho: 'CRM-GO 25.016', especialidade: 'Clínica Geral', procedimentos: [] },
];

const CLIENTES = [
  { nome: 'Mariana Costa Lima', whatsapp: '(62) 99812-4471', nascimento: '1991-04-18' },
  { nome: 'João Pedro Martins', whatsapp: '(62) 98544-1290', nascimento: '1985-09-02' },
  { nome: 'Fernanda Ribeiro', whatsapp: '(62) 99107-3358', nascimento: '1978-12-11' },
  { nome: 'Lucas Henrique Souza', whatsapp: '(62) 98233-6702', nascimento: '2000-06-25' },
  { nome: 'Patrícia Gomes', whatsapp: '(62) 99470-8815', nascimento: '1969-03-07' },
  { nome: 'Rafael Nogueira', whatsapp: '(62) 98691-2043', nascimento: '1994-11-30' },
  { nome: 'Camila Duarte', whatsapp: '(62) 99355-7189', nascimento: '1988-08-14' },
  { nome: 'Gustavo Pereira Reis', whatsapp: '(62) 98126-5534', nascimento: '1973-01-21' },
].map((c, i) => ({ ...c, id: `cli-${String(i + 1).padStart(2, '0')}` }));

// Modelo de um dia de agenda (sem choques entre profissional e local)
const MODELO_DIA = [
  { profissional: 'prof-ana', local: 'loc-centro-01', procedimento: 'proc-consulta-derm', hora: '09:00' },
  { profissional: 'prof-ana', local: 'loc-centro-01', procedimento: 'proc-retorno', hora: '10:00' },
  { profissional: 'prof-bruno', local: 'loc-centro-02', procedimento: 'proc-cardio-ecg', hora: '09:00' },
  { profissional: 'prof-bruno', local: 'loc-centro-02', procedimento: 'proc-retorno', hora: '14:00' },
  { profissional: 'prof-carla', local: 'loc-centro-proc', procedimento: 'proc-fisio', hora: '08:30' },
  { profissional: 'prof-carla', local: 'loc-centro-proc', procedimento: 'proc-fisio', hora: '15:00' },
  { profissional: 'prof-ana', local: 'loc-centro-proc', procedimento: 'proc-laser', hora: '16:00' },
];

function dataLocal(deslocamentoDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function popularSeVazio(banco: Banco): Promise<void> {
  const existente = await banco.um<{ total: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS total FROM clinicas');
  if (Number(existente?.total ?? 0) > 0) return;

  const agora = new Date().toISOString();
  const procedimentoPorId = new Map(PROCEDIMENTOS.map((p) => [p.id, p]));

  await banco.transacao(async (tx) => {
    await tx.executar('INSERT INTO clinicas (id, nome, cnpj, created_at) VALUES (?, ?, ?, ?)', [
      CLINICA_ID, 'Clínica Integrada AgendaFlex', '12.345.678/0001-95', agora,
    ]);

    for (const l of LOCAIS) {
      await tx.executar(
        `INSERT INTO locais (id, clinica_id, nome, endereco, horario_func, status, created_at) VALUES (?, ?, ?, ?, ?, 'ativo', ?)`,
        [l.id, CLINICA_ID, l.nome, l.endereco, JSON.stringify(l.horario), agora],
      );
    }
    for (const p of PROCEDIMENTOS) {
      await tx.executar(
        `INSERT INTO procedimentos (id, clinica_id, nome, duracao_min, valor, orientacoes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?)`,
        [p.id, CLINICA_ID, p.nome, p.duracao_min, p.valor, p.orientacoes, agora],
      );
    }
    for (const p of PROFISSIONAIS) {
      await tx.executar(
        `INSERT INTO profissionais (id, clinica_id, nome, cpf, registro_conselho, especialidade, status, procedimentos_vinculados, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?, ?)`,
        [p.id, CLINICA_ID, p.nome, p.cpf, p.registro_conselho, p.especialidade, JSON.stringify(p.procedimentos), agora],
      );
    }
    for (const c of CLIENTES) {
      await tx.executar(
        `INSERT INTO clientes (id, clinica_id, nome, whatsapp, nascimento, lgpd_consentimento, lgpd_consentimento_em, status, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, 'ativo', ?)`,
        [c.id, CLINICA_ID, c.nome, c.whatsapp, c.nascimento, agora, agora],
      );
    }

    // Agendamentos de 10 dias atrás até 5 dias à frente, só em dias úteis
    let contador = 0;
    for (let deslocamento = -10; deslocamento <= 5; deslocamento++) {
      const data = dataLocal(deslocamento);
      const semana = diaDaSemana(data);
      if (semana === 0 || semana === 6) continue;

      // Cada dia usa parte do modelo, para a ocupação variar
      const doDia = MODELO_DIA.filter((_, i) => (i + deslocamento + 20) % 3 !== 0 || deslocamento === 0);
      for (const item of doDia) {
        contador += 1;
        const proc = procedimentoPorId.get(item.procedimento)!;
        const cliente = CLIENTES[contador % CLIENTES.length];
        const inicio = paraMinutos(item.hora);
        let status = 'agendado';
        let whatsapp = deslocamento > 1 ? 'Aguardando Confirmação' : 'Confirmado';
        if (deslocamento < 0) {
          status = contador % 9 === 0 ? 'falta' : contador % 11 === 0 ? 'cancelado' : 'realizado';
          if (status === 'cancelado') whatsapp = 'Cancelado';
        }

        const id = `ag-demo-${String(contador).padStart(3, '0')}`;
        await tx.executar(
          `INSERT INTO agendamentos (id, clinica_id, cliente_id, profissional_id, local_id, procedimento_id, data_hora_inicio, data_hora_fim,
             status, whatsapp_status, origem, valor_total, duracao_total_min, observacoes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
          [
            id, CLINICA_ID, cliente.id, item.profissional, item.local, item.procedimento,
            montarDataHora(data, inicio), montarDataHora(data, inicio + proc.duracao_min),
            status, whatsapp, contador % 4 === 0 ? 'whatsapp' : 'recepcao', proc.valor, proc.duracao_min, agora,
          ],
        );
        await tx.executar(
          `INSERT INTO whatsapp_mensagens (id, agendamento_id, telefone, estado, conteudo, direcao, created_at)
           VALUES (?, ?, ?, 'Aguardando Confirmação', ?, 'enviada', ?)`,
          [crypto.randomUUID(), id, cliente.whatsapp, `Olá, ${cliente.nome.split(' ')[0]}! Confirme seu horário de ${proc.nome}.`, agora],
        );
      }
    }

    for (const [i, pedido] of [
      { cliente: 'cli-03', profissional: 'prof-ana', procedimento: 'proc-laser', local: 'loc-centro-proc', dias: 1 },
      { cliente: 'cli-06', profissional: 'prof-bruno', procedimento: 'proc-cardio-ecg', local: 'loc-centro-02', dias: 2 },
    ].entries()) {
      await tx.executar(
        `INSERT INTO lista_espera (id, clinica_id, cliente_id, profissional_id, procedimento_id, local_id, data_desejada, observacoes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aguardando', ?)`,
        [
          `le-demo-${i + 1}`, CLINICA_ID, pedido.cliente, pedido.profissional, pedido.procedimento, pedido.local,
          dataLocal(pedido.dias), 'Prefere horário pela manhã.', agora,
        ],
      );
    }

    await tx.executar(
      `INSERT INTO logs_auditoria (id, clinica_id, usuario, acao, entidade, entidade_id, detalhes, created_at)
       VALUES (?, ?, 'Sistema', 'CARGA_INICIAL', 'clinicas', ?, '{}', ?)`,
      [crypto.randomUUID(), CLINICA_ID, CLINICA_ID, agora],
    );
  });
}
