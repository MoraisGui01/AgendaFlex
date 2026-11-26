import crypto from 'node:crypto';
import { Router } from 'express';
import {
  carregarRecursos,
  dataBr,
  faixasOcupadas,
  garantirExpediente,
  garantirSemChoque,
} from '../agenda.ts';
import { operador } from '../auth.ts';
import { auditar } from '../auditoria.ts';
import type { Banco, Linha } from '../banco/conexao.ts';
import { CLINICA_ID } from '../config.ts';
import { naoEncontrado, requisicaoInvalida, rota, validar } from '../http.ts';
import {
  calcularHorariosLivres,
  dataValida,
  MINUTOS_NO_DIA,
  montarDataHora,
  paraHora,
  paraMinutos,
  separarDataHora,
} from '../horarios.ts';
import { extraSchema, novoAgendamentoSchema, statusAgendamentoSchema } from '../validacao.ts';

const CONSULTA_AGENDAMENTOS = `
  SELECT a.*,
         c.nome AS cliente_nome, c.whatsapp AS cliente_whatsapp,
         pr.nome AS profissional_nome, pr.especialidade AS profissional_especialidade,
         l.nome AS local_nome,
         p.nome AS procedimento_nome, p.duracao_min AS procedimento_duracao_min,
         p.valor AS procedimento_valor, p.orientacoes AS procedimento_orientacoes
  FROM agendamentos a
  JOIN clientes c ON c.id = a.cliente_id
  JOIN profissionais pr ON pr.id = a.profissional_id
  JOIN locais l ON l.id = a.local_id
  JOIN procedimentos p ON p.id = a.procedimento_id
  WHERE a.deleted_at IS NULL AND a.clinica_id = ?`;

function numeros(linha: Linha): Linha {
  return {
    ...linha,
    valor_total: Number(linha.valor_total),
    duracao_total_min: Number(linha.duracao_total_min),
    procedimento_valor: Number(linha.procedimento_valor),
    procedimento_duracao_min: Number(linha.procedimento_duracao_min),
  };
}

/** Junta os procedimentos extras de cada agendamento (uma consulta só). */
async function comExtras(banco: Banco, agendamentos: Linha[]): Promise<Linha[]> {
  if (agendamentos.length === 0) return [];
  const ids = agendamentos.map((a) => a.id);
  const extras = await banco.todos(
    `SELECT * FROM atendimento_procedimentos_extras WHERE agendamento_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at`,
    ids,
  );
  return agendamentos.map((a) => ({
    ...numeros(a),
    extras: extras
      .filter((e) => e.agendamento_id === a.id)
      .map((e) => ({ ...e, valor: Number(e.valor), duracao_min: Number(e.duracao_min) })),
  }));
}

export function rotasAgendamentos(banco: Banco): Router {
  const router = Router();

  // Horários livres para um profissional + local + procedimento em uma data
  router.get(
    '/disponibilidade',
    rota(async (req, res) => {
      const { profissional_id, local_id, procedimento_id, data } = req.query as Record<string, string>;
      if (!profissional_id || !local_id || !procedimento_id || !dataValida(String(data ?? ''))) {
        throw requisicaoInvalida('Informe profissional_id, local_id, procedimento_id e uma data válida (AAAA-MM-DD).');
      }

      let recursos;
      try {
        recursos = await carregarRecursos(banco, { profissional_id, local_id, procedimento_id });
      } catch (erro: any) {
        // Cadastro inativo ou sem vínculo: a tela mostra o motivo em vez de um erro
        return res.json({ slots: [], motivo: erro.message });
      }

      const duracao = recursos.procedimento.duracao_min;
      const ocupadas = await faixasOcupadas(banco, data, profissional_id, local_id);
      const livres = calcularHorariosLivres(recursos.local.horario, data, duracao, ocupadas);

      res.json({
        duracao_min: duracao,
        motivo: livres.length === 0 ? 'Nenhum horário livre nesta data.' : undefined,
        slots: livres.map((f) => ({
          hora_inicio: paraHora(f.inicio),
          hora_fim: paraHora(f.fim),
          data_hora_inicio: montarDataHora(data, f.inicio),
          data_hora_fim: montarDataHora(data, f.fim),
        })),
      });
    }),
  );

  router.get(
    '/agendamentos',
    rota(async (req, res) => {
      let sql = CONSULTA_AGENDAMENTOS;
      const parametros: unknown[] = [CLINICA_ID];
      const { data, cliente_id, profissional_id, local_id } = req.query as Record<string, string | undefined>;

      if (data) {
        sql += ' AND substr(a.data_hora_inicio, 1, 10) = ?';
        parametros.push(data);
      }
      if (cliente_id) {
        sql += ' AND a.cliente_id = ?';
        parametros.push(cliente_id);
      }
      if (profissional_id && profissional_id !== 'todos') {
        sql += ' AND a.profissional_id = ?';
        parametros.push(profissional_id);
      }
      if (local_id && local_id !== 'todos') {
        sql += ' AND a.local_id = ?';
        parametros.push(local_id);
      }
      sql += ' ORDER BY a.data_hora_inicio';

      res.json(await comExtras(banco, await banco.todos(sql, parametros)));
    }),
  );

  router.post(
    '/agendamentos',
    rota(async (req, res) => {
      const dados = validar(novoAgendamentoSchema, req.body);
      const inicioIso = dados.data_hora_inicio.length === 16 ? `${dados.data_hora_inicio}:00` : dados.data_hora_inicio;
      const { data, hora } = separarDataHora(inicioIso);

      const criado = await banco.transacao(async (tx) => {
        const r = await carregarRecursos(tx, dados);
        const inicio = paraMinutos(hora);
        const fim = inicio + r.procedimento.duracao_min;
        garantirExpediente(r.local.horario, data, { inicio, fim });

        const fimIso = montarDataHora(data, fim);
        await garantirSemChoque(tx, { ...dados, inicio: inicioIso, fim: fimIso });

        const id = crypto.randomUUID();
        const agora = new Date().toISOString();
        await tx.executar(
          `INSERT INTO agendamentos (id, clinica_id, cliente_id, profissional_id, local_id, procedimento_id,
             data_hora_inicio, data_hora_fim, status, whatsapp_status, origem, valor_total, duracao_total_min, observacoes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agendado', 'Aguardando Confirmação', ?, ?, ?, ?, ?)`,
          [
            id, CLINICA_ID, dados.cliente_id, dados.profissional_id, dados.local_id, dados.procedimento_id,
            inicioIso, fimIso, dados.origem, r.procedimento.valor, r.procedimento.duracao_min, dados.observacoes, agora,
          ],
        );

        // Mensagem automática de confirmação (integração WhatsApp simulada)
        const primeiroNome = String(r.cliente.nome).split(' ')[0];
        await tx.executar(
          `INSERT INTO whatsapp_mensagens (id, agendamento_id, telefone, estado, conteudo, direcao, created_at)
           VALUES (?, ?, ?, 'Aguardando Confirmação', ?, 'enviada', ?)`,
          [
            crypto.randomUUID(), id, r.cliente.whatsapp,
            `Olá, ${primeiroNome}! Seu horário de ${r.procedimento.nome} ficou para ${dataBr(data)} às ${hora}. ` +
              'Responda 1 para confirmar ou 2 para cancelar.',
            agora,
          ],
        );

        await auditar(tx, {
          usuario: operador(req),
          acao: 'CRIACAO_AGENDAMENTO',
          entidade: 'agendamentos',
          entidade_id: id,
          detalhes: { cliente: r.cliente.nome, procedimento: r.procedimento.nome, inicio: inicioIso, fim: fimIso },
        });

        return { ok: true, id, data_hora_inicio: inicioIso, data_hora_fim: fimIso };
      });

      res.status(201).json(criado);
    }),
  );

  router.patch(
    '/agendamentos/:id/status',
    rota(async (req, res) => {
      const { status } = validar(statusAgendamentoSchema, req.body);

      await banco.transacao(async (tx) => {
        const atual = await tx.um(`SELECT * FROM agendamentos WHERE id = ? AND deleted_at IS NULL`, [req.params.id]);
        if (!atual) throw naoEncontrado('Agendamento não encontrado.');

        // Reativar um cancelado só se o horário continuar livre
        if (atual.status === 'cancelado' && status !== 'cancelado') {
          await garantirSemChoque(
            tx,
            { ...(atual as any), inicio: atual.data_hora_inicio, fim: atual.data_hora_fim, ignorarId: atual.id },
            'O horário foi ocupado depois do cancelamento.',
          );
        }

        await tx.executar(`UPDATE agendamentos SET status = ? WHERE id = ?`, [status, atual.id]);
        await auditar(tx, {
          usuario: operador(req),
          acao: `STATUS_AGENDAMENTO_${status.toUpperCase()}`,
          entidade: 'agendamentos',
          entidade_id: atual.id,
          detalhes: { anterior: atual.status, novo: status },
        });
      });

      res.json({ ok: true, status });
    }),
  );

  // Procedimento adicional durante o atendimento: soma valor e estende a duração
  router.post(
    '/agendamentos/:id/extras',
    rota(async (req, res) => {
      const dados = validar(extraSchema, req.body);

      const resultado = await banco.transacao(async (tx) => {
        const ag = await tx.um(`SELECT * FROM agendamentos WHERE id = ? AND deleted_at IS NULL`, [req.params.id]);
        if (!ag) throw naoEncontrado('Agendamento não encontrado.');
        if (ag.status === 'cancelado') throw requisicaoInvalida('Não é possível adicionar extras a um agendamento cancelado.');

        if (dados.procedimento_id) {
          const existe = await tx.um(`SELECT id FROM procedimentos WHERE id = ? AND deleted_at IS NULL`, [dados.procedimento_id]);
          if (!existe) throw naoEncontrado('Procedimento extra não existe no catálogo.');
        }

        const { data, hora } = separarDataHora(ag.data_hora_inicio);
        const novaDuracao = Number(ag.duracao_total_min) + dados.duracao_min;
        const novoFim = paraMinutos(hora) + novaDuracao;
        if (novoFim > MINUTOS_NO_DIA) throw requisicaoInvalida('A duração estendida ultrapassa o fim do dia.');
        const novoFimIso = montarDataHora(data, novoFim);

        await garantirSemChoque(
          tx,
          { profissional_id: ag.profissional_id, local_id: ag.local_id, inicio: ag.data_hora_inicio, fim: novoFimIso, ignorarId: ag.id },
          'O tempo extra invade o próximo horário reservado.',
        );

        const extra = {
          id: crypto.randomUUID(),
          agendamento_id: ag.id,
          procedimento_id: dados.procedimento_id ?? null,
          nome_procedimento: dados.nome_procedimento,
          duracao_min: dados.duracao_min,
          valor: dados.valor,
          adicionado_por: operador(req),
          created_at: new Date().toISOString(),
        };
        await tx.executar(
          `INSERT INTO atendimento_procedimentos_extras (id, agendamento_id, procedimento_id, nome_procedimento, duracao_min, valor, adicionado_por, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          Object.values(extra),
        );

        const novoValor = Number(ag.valor_total) + dados.valor;
        await tx.executar(`UPDATE agendamentos SET valor_total = ?, duracao_total_min = ?, data_hora_fim = ? WHERE id = ?`, [
          novoValor, novaDuracao, novoFimIso, ag.id,
        ]);

        await auditar(tx, {
          usuario: extra.adicionado_por,
          acao: 'PROCEDIMENTO_EXTRA_ADICIONADO',
          entidade: 'agendamentos',
          entidade_id: ag.id,
          detalhes: { procedimento: dados.nome_procedimento, valor: dados.valor, novo_valor_total: novoValor },
        });

        return { ok: true, extra, valor_total: novoValor, duracao_total_min: novaDuracao, data_hora_fim: novoFimIso };
      });

      res.status(201).json(resultado);
    }),
  );

  return router;
}
