import { Router } from 'express';
import type { Banco, Linha } from '../banco/conexao.ts';
import { CLINICA_ID } from '../config.ts';
import { rota, validar } from '../http.ts';
import { periodoSchema } from '../validacao.ts';

// Capacidade considerada por local ativo em um dia: 8 horas de atendimento
const MINUTOS_UTEIS_POR_LOCAL = 8 * 60;

const CORES_STATUS: Record<string, { nome: string; cor: string }> = {
  realizado: { nome: 'Realizados', cor: '#16A34A' },
  falta: { nome: 'Faltas', cor: '#DC2626' },
  cancelado: { nome: 'Cancelados', cor: '#94A3B8' },
  agendado: { nome: 'Agendados', cor: '#2563EB' },
};

/** Calcula os indicadores do período (função pura, usada pela rota e pelos testes). */
export function montarRelatorio(agendamentos: Linha[], locaisAtivos: number) {
  const contar = (status: string) => agendamentos.filter((a) => a.status === status).length;
  const validos = agendamentos.filter((a) => a.status !== 'cancelado');
  const capacidadeDia = Math.max(1, locaisAtivos) * MINUTOS_UTEIS_POR_LOCAL;

  // Ocupação por dia: minutos agendados / capacidade
  const porDia = new Map<string, { atendimentos: number; minutos: number }>();
  for (const a of validos) {
    const dia = String(a.data_hora_inicio).slice(0, 10);
    const atual = porDia.get(dia) ?? { atendimentos: 0, minutos: 0 };
    atual.atendimentos += 1;
    atual.minutos += Number(a.duracao_total_min || 0);
    porDia.set(dia, atual);
  }
  const ocupacaoDiaria = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, info]) => ({
      data,
      label: `${data.slice(8, 10)}/${data.slice(5, 7)}`,
      ocupacao_pct: Math.min(100, Math.round((info.minutos / capacidadeDia) * 100)),
      atendimentos: info.atendimentos,
    }));

  // Procedimentos mais procurados (exceto cancelados)
  const porProcedimento = new Map<string, { quantidade: number; receita: number }>();
  for (const a of validos) {
    const atual = porProcedimento.get(a.procedimento_nome) ?? { quantidade: 0, receita: 0 };
    atual.quantidade += 1;
    atual.receita += Number(a.valor_total || 0);
    porProcedimento.set(a.procedimento_nome, atual);
  }

  return {
    resumo: {
      total_agendamentos: agendamentos.length,
      realizados: contar('realizado'),
      faltas: contar('falta'),
      cancelados: contar('cancelado'),
      agendados: contar('agendado'),
      taxa_ocupacao_pct: ocupacaoDiaria.length
        ? Math.round(ocupacaoDiaria.reduce((soma, d) => soma + d.ocupacao_pct, 0) / ocupacaoDiaria.length)
        : 0,
      receita_realizada: agendamentos
        .filter((a) => a.status === 'realizado')
        .reduce((soma, a) => soma + Number(a.valor_total || 0), 0),
    },
    ocupacao_diaria: ocupacaoDiaria,
    procedimentos_mais_realizados: [...porProcedimento.entries()]
      .map(([nome, info]) => ({ nome, ...info }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 6),
    faltas_vs_realizados: Object.entries(CORES_STATUS)
      .map(([status, { nome, cor }]) => ({ name: nome, value: contar(status), color: cor }))
      .filter((fatia) => fatia.value > 0),
  };
}

export function rotasRelatorios(banco: Banco): Router {
  const router = Router();

  router.get(
    '/relatorios',
    rota(async (req, res) => {
      const { from, to } = validar(periodoSchema, req.query);
      const agendamentos = await banco.todos(
        `SELECT a.status, a.data_hora_inicio, a.duracao_total_min, a.valor_total, p.nome AS procedimento_nome
         FROM agendamentos a
         JOIN procedimentos p ON p.id = a.procedimento_id
         WHERE a.deleted_at IS NULL AND a.clinica_id = ?
           AND substr(a.data_hora_inicio, 1, 10) BETWEEN ? AND ?`,
        [CLINICA_ID, from, to],
      );
      const locais = await banco.um<{ total: number }>(
        `SELECT CAST(COUNT(*) AS INTEGER) AS total FROM locais WHERE clinica_id = ? AND deleted_at IS NULL AND status = 'ativo'`,
        [CLINICA_ID],
      );
      res.json(montarRelatorio(agendamentos, Number(locais?.total ?? 0)));
    }),
  );

  router.get(
    '/logs-auditoria',
    rota(async (req, res) => {
      const pedido = Math.trunc(Number(req.query.limit ?? 50));
      const limite = Number.isFinite(pedido) ? Math.min(200, Math.max(1, pedido)) : 50;
      const logs = await banco.todos(
        `SELECT * FROM logs_auditoria WHERE clinica_id = ? ORDER BY created_at DESC LIMIT ?`,
        [CLINICA_ID, limite],
      );
      res.json(logs);
    }),
  );

  return router;
}
