import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { CLINICA_PADRAO_ID, getDb, registrarAuditoria } from './server/db.ts';

const PORT = 3000;

function getOperator(req: Request): string {
  const header = req.header('x-operator-name');
  return header && header.trim().length > 0 ? header.trim().slice(0, 80) : 'Dra. Camila Mendes (Admin)';
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function extractTime(iso: string): string {
  return iso.slice(11, 16);
}

// Validation schemas
const localSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do local é obrigatório'),
  endereco: z.string().trim().min(5, 'Endereço é obrigatório'),
  horario_func: z
    .object({
      abertura: z.string().regex(/^\d{2}:\d{2}$/),
      fechamento: z.string().regex(/^\d{2}:\d{2}$/),
      intervalo_inicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      intervalo_fim: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      dias: z.array(z.number().int().min(0).max(6)).min(1),
    })
    .refine((h) => parseMinutes(h.fechamento) > parseMinutes(h.abertura), {
      message: 'Horário de fechamento deve ser posterior à abertura',
    })
    .refine(
      (h) =>
        !h.intervalo_inicio ||
        !h.intervalo_fim ||
        parseMinutes(h.intervalo_fim) > parseMinutes(h.intervalo_inicio),
      { message: 'Fim do intervalo deve ser posterior ao início' }
    ),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

const profissionalSchema = z.object({
  nome: z.string().min(2, 'Nome do profissional é obrigatório'),
  cpf: z.string().min(11, 'CPF inválido'),
  registro_conselho: z.string().optional().default(''),
  especialidade: z.string().min(2, 'Especialidade é obrigatória'),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  procedimentos_vinculados: z.array(z.string()).default([]),
});

const clienteSchema = z.object({
  nome: z.string().min(2, 'Nome do cliente é obrigatório'),
  whatsapp: z.string().min(8, 'WhatsApp é obrigatório'),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida'),
  lgpd_consentimento: z.boolean().default(true),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

const procedimentoSchema = z.object({
  nome: z.string().min(2, 'Nome do procedimento é obrigatório'),
  duracao_min: z.number().int().positive('Duração deve ser maior que zero'),
  valor: z.number().nonnegative('Valor não pode ser negativo'),
  orientacoes: z.string().optional().default(''),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

const agendamentoCreateSchema = z.object({
  cliente_id: z.string().min(1),
  profissional_id: z.string().min(1),
  local_id: z.string().min(1),
  procedimento_id: z.string().min(1),
  data_hora_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/),
  origem: z.enum(['recepcao', 'whatsapp', 'portal', 'lista_espera']).default('recepcao'),
  observacoes: z.string().optional().default(''),
});

const extraProcSchema = z.object({
  procedimento_id: z.string().nullable().optional(),
  nome_procedimento: z.string().min(2),
  duracao_min: z.number().int().positive(),
  valor: z.number().nonnegative(),
});

const listaEsperaSchema = z.object({
  cliente_id: z.string().min(1),
  profissional_id: z.string().min(1),
  procedimento_id: z.string().min(1),
  local_id: z.string().min(1),
  data_desejada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacoes: z.string().optional().default(''),
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  const db = getDb();

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'AgendaFlex API' });
  });

  // ---------------- LOCAIS ----------------
  app.get('/api/locais', (req, res) => {
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const status = String(req.query.status ?? 'todos');
    const rows = db
      .prepare(
        `SELECT * FROM locais WHERE deleted_at IS NULL AND clinica_id = ? ORDER BY created_at DESC`
      )
      .all(CLINICA_PADRAO_ID) as Array<Record<string, unknown>>;

    const parsed = rows
      .map((r) => ({
        ...r,
        horario_func: JSON.parse(String(r.horario_func)),
      }))
      .filter((r: any) => {
        const matchSearch =
          !search ||
          r.nome.toLowerCase().includes(search) ||
          r.endereco.toLowerCase().includes(search);
        const matchStatus = status === 'todos' || r.status === status;
        return matchSearch && matchStatus;
      });
    res.json(parsed);
  });

  app.post('/api/locais', (req, res) => {
    const parsed = localSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const d = parsed.data;
    db.transaction(() => {
      db.prepare(
        `INSERT INTO locais (id, clinica_id, nome, endereco, horario_func, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, CLINICA_PADRAO_ID, d.nome, d.endereco, JSON.stringify(d.horario_func), d.status, now);

      registrarAuditoria(db, {
        usuario: getOperator(req),
        acao: 'CRIACAO_LOCAL',
        entidade: 'locais',
        entidade_id: id,
        detalhes: { nome: d.nome },
      });
    })();

    res.status(201).json({ id, clinica_id: CLINICA_PADRAO_ID, ...d, created_at: now, deleted_at: null });
  });

  app.put('/api/locais/:id', (req, res) => {
    const parsed = localSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    const existing = db
      .prepare(`SELECT * FROM locais WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as Record<string, any> | undefined;
    if (!existing) return res.status(404).json({ error: 'Local não encontrado' });

    const d = parsed.data;
    const updated = {
      nome: d.nome ?? existing.nome,
      endereco: d.endereco ?? existing.endereco,
      horario_func: d.horario_func ? JSON.stringify(d.horario_func) : existing.horario_func,
      status: d.status ?? existing.status,
    };

    db.prepare(`UPDATE locais SET nome = ?, endereco = ?, horario_func = ?, status = ? WHERE id = ?`).run(
      updated.nome,
      updated.endereco,
      updated.horario_func,
      updated.status,
      req.params.id
    );

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: d.status && d.status !== existing.status ? `STATUS_LOCAL_${d.status.toUpperCase()}` : 'ATUALIZACAO_LOCAL',
      entidade: 'locais',
      entidade_id: req.params.id,
      detalhes: { nome: updated.nome, status: updated.status },
    });

    res.json({
      ...existing,
      ...updated,
      horario_func: JSON.parse(updated.horario_func),
    });
  });

  app.delete('/api/locais/:id', (req, res) => {
    const existing = db
      .prepare(`SELECT id, nome FROM locais WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as { id: string; nome: string } | undefined;
    if (!existing) return res.status(404).json({ error: 'Local não encontrado' });

    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(`UPDATE locais SET deleted_at = ?, status = 'inativo' WHERE id = ?`).run(now, req.params.id);

      registrarAuditoria(db, {
        usuario: getOperator(req),
        acao: 'SOFT_DELETE_LOCAL',
        entidade: 'locais',
        entidade_id: req.params.id,
        detalhes: { nome: existing.nome, deleted_at: now },
      });
    })();

    res.json({ ok: true, deleted_at: now });
  });

  // ---------------- PROFISSIONAIS ----------------
  app.get('/api/profissionais', (req, res) => {
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const status = String(req.query.status ?? 'todos');
    const rows = db
      .prepare(
        `SELECT * FROM profissionais WHERE deleted_at IS NULL AND clinica_id = ? ORDER BY created_at DESC`
      )
      .all(CLINICA_PADRAO_ID) as Array<Record<string, unknown>>;

    const parsed = rows
      .map((r) => ({
        ...r,
        procedimentos_vinculados: JSON.parse(String(r.procedimentos_vinculados || '[]')),
      }))
      .filter((r: any) => {
        const matchSearch =
          !search ||
          r.nome.toLowerCase().includes(search) ||
          r.especialidade.toLowerCase().includes(search) ||
          r.cpf.includes(search);
        const matchStatus = status === 'todos' || r.status === status;
        return matchSearch && matchStatus;
      });
    res.json(parsed);
  });

  app.post('/api/profissionais', (req, res) => {
    const parsed = profissionalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const d = parsed.data;
    db.prepare(
      `INSERT INTO profissionais (id, clinica_id, nome, cpf, registro_conselho, especialidade, status, procedimentos_vinculados, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      CLINICA_PADRAO_ID,
      d.nome,
      d.cpf,
      d.registro_conselho,
      d.especialidade,
      d.status,
      JSON.stringify(d.procedimentos_vinculados),
      now
    );

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: 'CRIACAO_PROFISSIONAL',
      entidade: 'profissionais',
      entidade_id: id,
      detalhes: { nome: d.nome, especialidade: d.especialidade },
    });

    res.status(201).json({ id, clinica_id: CLINICA_PADRAO_ID, ...d, created_at: now, deleted_at: null });
  });

  app.put('/api/profissionais/:id', (req, res) => {
    const parsed = profissionalSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    const existing = db
      .prepare(`SELECT * FROM profissionais WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as Record<string, any> | undefined;
    if (!existing) return res.status(404).json({ error: 'Profissional não encontrado' });

    const d = parsed.data;
    const updated = {
      nome: d.nome ?? existing.nome,
      cpf: d.cpf ?? existing.cpf,
      registro_conselho: d.registro_conselho ?? existing.registro_conselho,
      especialidade: d.especialidade ?? existing.especialidade,
      status: d.status ?? existing.status,
      procedimentos_vinculados: d.procedimentos_vinculados
        ? JSON.stringify(d.procedimentos_vinculados)
        : existing.procedimentos_vinculados,
    };

    db.prepare(
      `UPDATE profissionais SET nome = ?, cpf = ?, registro_conselho = ?, especialidade = ?, status = ?, procedimentos_vinculados = ? WHERE id = ?`
    ).run(
      updated.nome,
      updated.cpf,
      updated.registro_conselho,
      updated.especialidade,
      updated.status,
      updated.procedimentos_vinculados,
      req.params.id
    );

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao:
        d.status && d.status !== existing.status
          ? `STATUS_PROFISSIONAL_${d.status.toUpperCase()}`
          : 'ATUALIZACAO_PROFISSIONAL',
      entidade: 'profissionais',
      entidade_id: req.params.id,
      detalhes: { nome: updated.nome, status: updated.status },
    });

    res.json({
      ...existing,
      ...updated,
      procedimentos_vinculados: JSON.parse(updated.procedimentos_vinculados),
    });
  });

  app.delete('/api/profissionais/:id', (req, res) => {
    const existing = db
      .prepare(`SELECT id, nome FROM profissionais WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as { id: string; nome: string } | undefined;
    if (!existing) return res.status(404).json({ error: 'Profissional não encontrado' });

    const now = new Date().toISOString();
    db.prepare(`UPDATE profissionais SET deleted_at = ?, status = 'inativo' WHERE id = ?`).run(now, req.params.id);

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: 'SOFT_DELETE_PROFISSIONAL',
      entidade: 'profissionais',
      entidade_id: req.params.id,
      detalhes: { nome: existing.nome, deleted_at: now },
    });

    res.json({ ok: true, deleted_at: now });
  });

  // ---------------- CLIENTES ----------------
  app.get('/api/clientes', (req, res) => {
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const status = String(req.query.status ?? 'todos');
    const rows = db
      .prepare(
        `SELECT * FROM clientes WHERE deleted_at IS NULL AND clinica_id = ? ORDER BY created_at DESC`
      )
      .all(CLINICA_PADRAO_ID) as Array<Record<string, any>>;

    const parsed = rows
      .map((r): Record<string, any> => ({
        ...r,
        lgpd_consentimento: Boolean(r.lgpd_consentimento),
      }))
      .filter((r) => {
        const matchSearch =
          !search ||
          String(r.nome).toLowerCase().includes(search) ||
          String(r.whatsapp).toLowerCase().includes(search);
        const matchStatus = status === 'todos' || r.status === status;
        return matchSearch && matchStatus;
      });
    res.json(parsed);
  });

  app.post('/api/clientes', (req, res) => {
    const parsed = clienteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const d = parsed.data;
    db.prepare(
      `INSERT INTO clientes (id, clinica_id, nome, whatsapp, nascimento, lgpd_consentimento, lgpd_consentimento_em, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      CLINICA_PADRAO_ID,
      d.nome,
      d.whatsapp,
      d.nascimento,
      d.lgpd_consentimento ? 1 : 0,
      now,
      d.status,
      now
    );

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: 'CRIACAO_CLIENTE',
      entidade: 'clientes',
      entidade_id: id,
      detalhes: { nome: d.nome, lgpd_consentimento: d.lgpd_consentimento },
    });

    res.status(201).json({
      id,
      clinica_id: CLINICA_PADRAO_ID,
      ...d,
      lgpd_consentimento_em: now,
      created_at: now,
      deleted_at: null,
    });
  });

  app.put('/api/clientes/:id', (req, res) => {
    const parsed = clienteSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    const existing = db
      .prepare(`SELECT * FROM clientes WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as Record<string, any> | undefined;
    if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });

    const d = parsed.data;
    const updated = {
      nome: d.nome ?? existing.nome,
      whatsapp: d.whatsapp ?? existing.whatsapp,
      nascimento: d.nascimento ?? existing.nascimento,
      lgpd_consentimento:
        d.lgpd_consentimento !== undefined ? (d.lgpd_consentimento ? 1 : 0) : existing.lgpd_consentimento,
      status: d.status ?? existing.status,
    };

    db.prepare(
      `UPDATE clientes SET nome = ?, whatsapp = ?, nascimento = ?, lgpd_consentimento = ?, status = ? WHERE id = ?`
    ).run(updated.nome, updated.whatsapp, updated.nascimento, updated.lgpd_consentimento, updated.status, req.params.id);

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: d.status && d.status !== existing.status ? `STATUS_CLIENTE_${d.status.toUpperCase()}` : 'ATUALIZACAO_CLIENTE',
      entidade: 'clientes',
      entidade_id: req.params.id,
      detalhes: { nome: updated.nome, status: updated.status },
    });

    res.json({
      ...existing,
      ...updated,
      lgpd_consentimento: Boolean(updated.lgpd_consentimento),
    });
  });

  app.delete('/api/clientes/:id', (req, res) => {
    const existing = db
      .prepare(`SELECT id, nome FROM clientes WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as { id: string; nome: string } | undefined;
    if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });

    const now = new Date().toISOString();
    db.prepare(`UPDATE clientes SET deleted_at = ?, status = 'inativo' WHERE id = ?`).run(now, req.params.id);

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: 'SOFT_DELETE_CLIENTE_LGPD',
      entidade: 'clientes',
      entidade_id: req.params.id,
      detalhes: { nome: existing.nome, deleted_at: now },
    });

    res.json({ ok: true, deleted_at: now });
  });

  // ---------------- PROCEDIMENTOS ----------------
  app.get('/api/procedimentos', (req, res) => {
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const status = String(req.query.status ?? 'todos');
    const rows = db
      .prepare(
        `SELECT * FROM procedimentos WHERE deleted_at IS NULL AND clinica_id = ? ORDER BY created_at DESC`
      )
      .all(CLINICA_PADRAO_ID) as Array<Record<string, any>>;

    const filtered = rows.filter((r) => {
      const matchSearch =
        !search ||
        r.nome.toLowerCase().includes(search) ||
        r.orientacoes.toLowerCase().includes(search);
      const matchStatus = status === 'todos' || r.status === status;
      return matchSearch && matchStatus;
    });
    res.json(filtered);
  });

  app.post('/api/procedimentos', (req, res) => {
    const parsed = procedimentoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const d = parsed.data;
    db.prepare(
      `INSERT INTO procedimentos (id, clinica_id, nome, duracao_min, valor, orientacoes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, CLINICA_PADRAO_ID, d.nome, d.duracao_min, d.valor, d.orientacoes, d.status, now);

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: 'CRIACAO_PROCEDIMENTO',
      entidade: 'procedimentos',
      entidade_id: id,
      detalhes: { nome: d.nome, duracao_min: d.duracao_min, valor: d.valor },
    });

    res.status(201).json({ id, clinica_id: CLINICA_PADRAO_ID, ...d, created_at: now, deleted_at: null });
  });

  app.put('/api/procedimentos/:id', (req, res) => {
    const parsed = procedimentoSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    const existing = db
      .prepare(`SELECT * FROM procedimentos WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as Record<string, any> | undefined;
    if (!existing) return res.status(404).json({ error: 'Procedimento não encontrado' });

    const d = parsed.data;
    const updated = {
      nome: d.nome ?? existing.nome,
      duracao_min: d.duracao_min ?? existing.duracao_min,
      valor: d.valor ?? existing.valor,
      orientacoes: d.orientacoes ?? existing.orientacoes,
      status: d.status ?? existing.status,
    };

    db.prepare(
      `UPDATE procedimentos SET nome = ?, duracao_min = ?, valor = ?, orientacoes = ?, status = ? WHERE id = ?`
    ).run(updated.nome, updated.duracao_min, updated.valor, updated.orientacoes, updated.status, req.params.id);

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao:
        d.status && d.status !== existing.status
          ? `STATUS_PROCEDIMENTO_${d.status.toUpperCase()}`
          : 'ATUALIZACAO_PROCEDIMENTO',
      entidade: 'procedimentos',
      entidade_id: req.params.id,
      detalhes: { nome: updated.nome, status: updated.status },
    });

    res.json({ ...existing, ...updated });
  });

  app.delete('/api/procedimentos/:id', (req, res) => {
    const existing = db
      .prepare(`SELECT id, nome FROM procedimentos WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as { id: string; nome: string } | undefined;
    if (!existing) return res.status(404).json({ error: 'Procedimento não encontrado' });

    const now = new Date().toISOString();
    db.prepare(`UPDATE procedimentos SET deleted_at = ?, status = 'inativo' WHERE id = ?`).run(now, req.params.id);

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: 'SOFT_DELETE_PROCEDIMENTO',
      entidade: 'procedimentos',
      entidade_id: req.params.id,
      detalhes: { nome: existing.nome, deleted_at: now },
    });

    res.json({ ok: true, deleted_at: now });
  });

  // ---------------- DISPONIBILIDADE (CONFLICT ENGINE) ----------------
  app.get('/api/disponibilidade', (req, res) => {
    const profissionalId = String(req.query.profissional_id ?? '');
    const localId = String(req.query.local_id ?? '');
    const procedimentoId = String(req.query.procedimento_id ?? '');
    const data = String(req.query.data ?? '');

    if (!profissionalId || !localId || !procedimentoId || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: profissional_id, local_id, procedimento_id e data' });
    }

    const proc = db
      .prepare(`SELECT duracao_min, status FROM procedimentos WHERE id = ? AND deleted_at IS NULL`)
      .get(procedimentoId) as { duracao_min: number; status: string } | undefined;
    const local = db
      .prepare(`SELECT horario_func, status FROM locais WHERE id = ? AND deleted_at IS NULL`)
      .get(localId) as { horario_func: string; status: string } | undefined;
    const prof = db
      .prepare(`SELECT status, procedimentos_vinculados FROM profissionais WHERE id = ? AND deleted_at IS NULL`)
      .get(profissionalId) as { status: string; procedimentos_vinculados: string } | undefined;

    if (!proc || !local || !prof) {
      return res.status(404).json({ error: 'Profissional, procedimento ou local não encontrado' });
    }

    if (local.status !== 'ativo') {
      return res.json({ slots: [], motivo: 'Local inativo' });
    }
    if (prof.status !== 'ativo') {
      return res.json({ slots: [], motivo: 'Profissional inativo' });
    }
    if (proc.status !== 'ativo') {
      return res.json({ slots: [], motivo: 'Procedimento inativo' });
    }

    const horario = JSON.parse(local.horario_func) as {
      abertura: string;
      fechamento: string;
      intervalo_inicio?: string;
      intervalo_fim?: string;
      dias: number[];
    };

    const [year, month, day] = data.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    if (!horario.dias.includes(dayOfWeek)) {
      return res.json({ slots: [], motivo: 'Unidade fechada neste dia da semana' });
    }

    const startMin = parseMinutes(horario.abertura);
    const endMin = parseMinutes(horario.fechamento);
    const breakStart = horario.intervalo_inicio ? parseMinutes(horario.intervalo_inicio) : null;
    const breakEnd = horario.intervalo_fim ? parseMinutes(horario.intervalo_fim) : null;

    const ocupados = db
      .prepare(
        `SELECT data_hora_inicio, data_hora_fim, profissional_id, local_id
         FROM agendamentos
         WHERE deleted_at IS NULL
           AND status != 'cancelado'
           AND substr(data_hora_inicio, 1, 10) = ?
           AND (profissional_id = ? OR local_id = ?)`
      )
      .all(data, profissionalId, localId) as Array<{
      data_hora_inicio: string;
      data_hora_fim: string;
      profissional_id: string;
      local_id: string;
    }>;

    const busyRanges = ocupados.map((o) => ({
      start: parseMinutes(extractTime(o.data_hora_inicio)),
      end: parseMinutes(extractTime(o.data_hora_fim)),
    }));

    const slots: Array<{
      hora_inicio: string;
      hora_fim: string;
      data_hora_inicio: string;
      data_hora_fim: string;
    }> = [];

    for (let t = startMin; t + proc.duracao_min <= endMin; t += 30) {
      const slotEnd = t + proc.duracao_min;

      // Respeita intervalo de almoço da unidade
      if (breakStart !== null && breakEnd !== null && t < breakEnd && slotEnd > breakStart) {
        continue;
      }

      const hasConflict = busyRanges.some((b) => b.start < slotEnd && b.end > t);
      if (!hasConflict) {
        const hIni = formatMinutes(t);
        const hFim = formatMinutes(slotEnd);
        slots.push({
          hora_inicio: hIni,
          hora_fim: hFim,
          data_hora_inicio: `${data}T${hIni}:00`,
          data_hora_fim: `${data}T${hFim}:00`,
        });
      }
    }

    res.json({ slots, duracao_min: proc.duracao_min });
  });

  // ---------------- AGENDAMENTOS ----------------
  app.get('/api/agendamentos', (req, res) => {
    const data = req.query.data ? String(req.query.data) : null;
    const clienteId = req.query.cliente_id ? String(req.query.cliente_id) : null;
    const profissionalId = req.query.profissional_id ? String(req.query.profissional_id) : null;

    let query = `
      SELECT
        a.*,
        c.nome AS cliente_nome,
        c.whatsapp AS cliente_whatsapp,
        pr.nome AS profissional_nome,
        pr.especialidade AS profissional_especialidade,
        l.nome AS local_nome,
        p.nome AS procedimento_nome,
        p.duracao_min AS procedimento_duracao_min,
        p.valor AS procedimento_valor,
        p.orientacoes AS procedimento_orientacoes
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      JOIN profissionais pr ON pr.id = a.profissional_id
      JOIN locais l ON l.id = a.local_id
      JOIN procedimentos p ON p.id = a.procedimento_id
      WHERE a.deleted_at IS NULL AND a.clinica_id = ?
    `;
    const params: unknown[] = [CLINICA_PADRAO_ID];

    if (data) {
      query += ` AND substr(a.data_hora_inicio, 1, 10) = ?`;
      params.push(data);
    }
    if (clienteId) {
      query += ` AND a.cliente_id = ?`;
      params.push(clienteId);
    }
    if (profissionalId && profissionalId !== 'todos') {
      query += ` AND a.profissional_id = ?`;
      params.push(profissionalId);
    }

    query += ` ORDER BY a.data_hora_inicio ASC`;

    const rows = db.prepare(query).all(...params) as Array<Record<string, any>>;

    const extrasStmt = db.prepare(
      `SELECT * FROM atendimento_procedimentos_extras WHERE agendamento_id = ? ORDER BY created_at ASC`
    );

    const enriched = rows.map((row) => ({
      ...row,
      extras: extrasStmt.all(row.id),
    }));

    res.json(enriched);
  });

  app.post('/api/agendamentos', (req, res) => {
    const parsed = agendamentoCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados de agendamento inválidos' });
    }
    const d = parsed.data;
    const startIso = d.data_hora_inicio.length === 16 ? `${d.data_hora_inicio}:00` : d.data_hora_inicio;

    const createTx = db.transaction(() => {
      const proc = db
        .prepare(`SELECT id, nome, duracao_min, valor FROM procedimentos WHERE id = ? AND deleted_at IS NULL AND status = 'ativo'`)
        .get(d.procedimento_id) as { id: string; nome: string; duracao_min: number; valor: number } | undefined;
      if (!proc) {
        return { error: 'Procedimento não encontrado ou inativo.', status: 404 as const };
      }

      const cli = db
        .prepare(`SELECT id, nome, whatsapp FROM clientes WHERE id = ? AND deleted_at IS NULL AND status = 'ativo'`)
        .get(d.cliente_id) as { id: string; nome: string; whatsapp: string } | undefined;
      if (!cli) {
        return { error: 'Cliente não encontrado ou inativo.', status: 404 as const };
      }

      const prof = db
        .prepare(`SELECT id, nome, procedimentos_vinculados FROM profissionais WHERE id = ? AND deleted_at IS NULL AND status = 'ativo'`)
        .get(d.profissional_id) as { id: string; nome: string; procedimentos_vinculados: string } | undefined;
      if (!prof) {
        return { error: 'Profissional não encontrado ou inativo.', status: 404 as const };
      }

      const local = db
        .prepare(`SELECT id, nome, horario_func FROM locais WHERE id = ? AND deleted_at IS NULL AND status = 'ativo'`)
        .get(d.local_id) as { id: string; nome: string; horario_func: string } | undefined;
      if (!local) {
        return { error: 'Local/consultório não encontrado ou inativo.', status: 404 as const };
      }

      const dateStr = startIso.slice(0, 10);
      const startTime = startIso.slice(11, 16);
      const startMin = parseMinutes(startTime);
      const endMin = startMin + proc.duracao_min;
      if (endMin > 24 * 60) {
        return { error: 'Erro ao validar disponibilidade. Horário ultrapassa o expediente diário.', status: 400 as const };
      }
      const endIso = `${dateStr}T${formatMinutes(endMin)}:00`;

      // Validar janela de funcionamento do local (dia da semana, abertura/fechamento, intervalo)
      const horario = JSON.parse(local.horario_func) as {
        abertura: string;
        fechamento: string;
        intervalo_inicio?: string;
        intervalo_fim?: string;
        dias: number[];
      };
      const [year, month, day] = dateStr.split('-').map(Number);
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      if (!horario.dias.includes(dayOfWeek)) {
        return { error: 'Erro ao validar disponibilidade. Unidade fechada neste dia da semana.', status: 409 as const };
      }
      const openMin = parseMinutes(horario.abertura);
      const closeMin = parseMinutes(horario.fechamento);
      if (startMin < openMin || endMin > closeMin) {
        return {
          error: `Erro ao validar disponibilidade. Horário fora do expediente do local (${horario.abertura}–${horario.fechamento}).`,
          status: 409 as const,
        };
      }
      if (horario.intervalo_inicio && horario.intervalo_fim) {
        const bStart = parseMinutes(horario.intervalo_inicio);
        const bEnd = parseMinutes(horario.intervalo_fim);
        if (startMin < bEnd && endMin > bStart) {
          return {
            error: `Erro ao validar disponibilidade. Conflito com intervalo da unidade (${horario.intervalo_inicio}–${horario.intervalo_fim}).`,
            status: 409 as const,
          };
        }
      }

      // Validação estrita de conflito: profissional e local não podem ter atendimentos simultâneos
      const conflito = db
        .prepare(
          `SELECT id, profissional_id, local_id, data_hora_inicio, data_hora_fim
           FROM agendamentos
           WHERE deleted_at IS NULL
             AND status != 'cancelado'
             AND (profissional_id = ? OR local_id = ?)
             AND data_hora_inicio < ?
             AND data_hora_fim > ?`
        )
        .get(d.profissional_id, d.local_id, endIso, startIso) as
        | { id: string; profissional_id: string; local_id: string }
        | undefined;

      if (conflito) {
        const motivo =
          conflito.profissional_id === d.profissional_id
            ? 'O profissional já possui atendimento neste horário.'
            : 'O local/consultório já está reservado neste horário.';
        return {
          error: `Erro ao validar disponibilidade. ${motivo}`,
          status: 409 as const,
        };
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO agendamentos (
          id, clinica_id, cliente_id, profissional_id, local_id, procedimento_id,
          data_hora_inicio, data_hora_fim, status, whatsapp_status, origem,
          valor_total, duracao_total_min, observacoes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agendado', 'Aguardando Confirmação', ?, ?, ?, ?, ?)`
      ).run(
        id,
        CLINICA_PADRAO_ID,
        d.cliente_id,
        d.profissional_id,
        d.local_id,
        d.procedimento_id,
        startIso,
        endIso,
        d.origem,
        proc.valor,
        proc.duracao_min,
        d.observacoes,
        now
      );

      // Dispara mensagem automática simulada via Edge Function WhatsApp
      db.prepare(
        `INSERT INTO whatsapp_mensagens (id, agendamento_id, telefone, estado, conteudo, direcao, created_at)
         VALUES (?, ?, ?, 'Aguardando Confirmação', ?, 'enviada', ?)`
      ).run(
        crypto.randomUUID(),
        id,
        cli.whatsapp,
        `Olá ${cli.nome.split(' ')[0]}, recebemos seu agendamento de ${proc.nome} para ${dateStr
          .split('-')
          .reverse()
          .join('/')} às ${startTime}. Responda 1 para Confirmar ou 2 para Cancelar.`,
        now
      );

      registrarAuditoria(db, {
        usuario: getOperator(req),
        acao: 'CRIACAO_AGENDAMENTO',
        entidade: 'agendamentos',
        entidade_id: id,
        detalhes: {
          cliente: cli.nome,
          procedimento: proc.nome,
          data_hora_inicio: startIso,
          data_hora_fim: endIso,
        },
      });

      return { ok: true, id, data_hora_inicio: startIso, data_hora_fim: endIso };
    });

    const result = createTx();
    if ('error' in result && result.error) {
      return res.status(result.status ?? 409).json({ error: result.error });
    }
    res.status(201).json(result);
  });

  app.patch('/api/agendamentos/:id/status', (req, res) => {
    const schema = z.object({
      status: z.enum(['agendado', 'realizado', 'falta', 'cancelado']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const existing = db
      .prepare(`SELECT * FROM agendamentos WHERE id = ? AND deleted_at IS NULL`)
      .get(req.params.id) as Record<string, any> | undefined;
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const newStatus = parsed.data.status;
    db.prepare(`UPDATE agendamentos SET status = ? WHERE id = ?`).run(newStatus, req.params.id);

    registrarAuditoria(db, {
      usuario: getOperator(req),
      acao: `STATUS_AGENDAMENTO_${newStatus.toUpperCase()}`,
      entidade: 'agendamentos',
      entidade_id: req.params.id,
      detalhes: { anterior: existing.status, novo: newStatus },
    });

    res.json({ ok: true, status: newStatus });
  });

  // ---------------- ATENDIMENTO: PROCEDIMENTOS EXTRAS ----------------
  app.post('/api/agendamentos/:id/extras', (req, res) => {
    const parsed = extraProcSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados do procedimento extra inválidos' });
    }

    const tx = db.transaction(() => {
      const ag = db
        .prepare(
          `SELECT id, profissional_id, local_id, status, valor_total, duracao_total_min, data_hora_inicio, data_hora_fim
           FROM agendamentos WHERE id = ? AND deleted_at IS NULL`
        )
        .get(req.params.id) as
        | {
            id: string;
            profissional_id: string;
            local_id: string;
            status: string;
            valor_total: number;
            duracao_total_min: number;
            data_hora_inicio: string;
            data_hora_fim: string;
          }
        | undefined;

      if (!ag) {
        return { error: 'Agendamento não encontrado', status: 404 as const };
      }
      if (ag.status === 'cancelado') {
        return { error: 'Não é possível adicionar procedimento extra em agendamento cancelado.', status: 400 as const };
      }

      const d = parsed.data;
      const now = new Date().toISOString();
      const extraId = crypto.randomUUID();
      const operator = getOperator(req);

      const novoValor = Number(ag.valor_total) + Number(d.valor);
      const novaDuracao = Number(ag.duracao_total_min) + Number(d.duracao_min);
      const dateStr = ag.data_hora_inicio.slice(0, 10);
      const startTime = ag.data_hora_inicio.slice(11, 16);
      const newEndMin = parseMinutes(startTime) + novaDuracao;
      if (newEndMin > 24 * 60) {
        return { error: 'Duração estendida ultrapassa o limite do dia.', status: 400 as const };
      }
      const newEndIso = `${dateStr}T${formatMinutes(newEndMin)}:00`;

      // Verifica se estender o atendimento cria choque com outro paciente já agendado na mesma sala ou profissional
      const choqueExtensao = db
        .prepare(
          `SELECT id FROM agendamentos
           WHERE id != ?
             AND deleted_at IS NULL
             AND status != 'cancelado'
             AND (profissional_id = ? OR local_id = ?)
             AND data_hora_inicio < ?
             AND data_hora_fim > ?`
        )
        .get(ag.id, ag.profissional_id, ag.local_id, newEndIso, ag.data_hora_inicio);

      if (choqueExtensao) {
        return {
          error: 'Erro ao validar disponibilidade. O tempo extra colide com o próximo horário reservado.',
          status: 409 as const,
        };
      }

      db.prepare(
        `INSERT INTO atendimento_procedimentos_extras (id, agendamento_id, procedimento_id, nome_procedimento, duracao_min, valor, adicionado_por, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        extraId,
        ag.id,
        d.procedimento_id ?? null,
        d.nome_procedimento,
        d.duracao_min,
        d.valor,
        operator,
        now
      );

      db.prepare(
        `UPDATE agendamentos SET valor_total = ?, duracao_total_min = ?, data_hora_fim = ? WHERE id = ?`
      ).run(novoValor, novaDuracao, newEndIso, ag.id);

      registrarAuditoria(db, {
        usuario: operator,
        acao: 'PROCEDIMENTO_EXTRA_ADICIONADO',
        entidade: 'agendamentos',
        entidade_id: ag.id,
        detalhes: {
          nome_procedimento: d.nome_procedimento,
          duracao_min: d.duracao_min,
          valor: d.valor,
          novo_valor_total: novoValor,
        },
      });

      return {
        ok: true,
        extra: {
          id: extraId,
          agendamento_id: ag.id,
          procedimento_id: d.procedimento_id ?? null,
          nome_procedimento: d.nome_procedimento,
          duracao_min: d.duracao_min,
          valor: d.valor,
          adicionado_por: operator,
          created_at: now,
        },
        valor_total: novoValor,
        duracao_total_min: novaDuracao,
        data_hora_fim: newEndIso,
      };
    });

    const result = tx();
    if ('error' in result && result.error) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }
    res.status(201).json(result);
  });

  // ---------------- LISTA DE ESPERA ----------------
  app.get('/api/lista-espera', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT
           le.*,
           c.nome AS cliente_nome,
           c.whatsapp AS cliente_whatsapp,
           pr.nome AS profissional_nome,
           p.nome AS procedimento_nome,
           l.nome AS local_nome
         FROM lista_espera le
         JOIN clientes c ON c.id = le.cliente_id
         JOIN profissionais pr ON pr.id = le.profissional_id
         JOIN procedimentos p ON p.id = le.procedimento_id
         JOIN locais l ON l.id = le.local_id
         WHERE le.clinica_id = ?
         ORDER BY le.created_at DESC`
      )
      .all(CLINICA_PADRAO_ID);
    res.json(rows);
  });

  app.post('/api/lista-espera', (req, res) => {
    const parsed = listaEsperaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos para lista de espera' });
    }
    const d = parsed.data;
    const cli = db.prepare(`SELECT id FROM clientes WHERE id = ? AND deleted_at IS NULL`).get(d.cliente_id);
    const prof = db.prepare(`SELECT id FROM profissionais WHERE id = ? AND deleted_at IS NULL`).get(d.profissional_id);
    const proc = db.prepare(`SELECT id FROM procedimentos WHERE id = ? AND deleted_at IS NULL`).get(d.procedimento_id);
    const loc = db.prepare(`SELECT id FROM locais WHERE id = ? AND deleted_at IS NULL`).get(d.local_id);

    if (!cli || !prof || !proc || !loc) {
      return res.status(404).json({ error: 'Cliente, profissional, procedimento ou local não encontrado.' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(
        `INSERT INTO lista_espera (id, clinica_id, cliente_id, profissional_id, procedimento_id, local_id, data_desejada, observacoes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aguardando', ?)`
      ).run(id, CLINICA_PADRAO_ID, d.cliente_id, d.profissional_id, d.procedimento_id, d.local_id, d.data_desejada, d.observacoes, now);

      registrarAuditoria(db, {
        usuario: getOperator(req),
        acao: 'INSCRICAO_LISTA_ESPERA',
        entidade: 'lista_espera',
        entidade_id: id,
        detalhes: { data_desejada: d.data_desejada, cliente_id: d.cliente_id },
      });
    })();

    res.status(201).json({ id, ...d, status: 'aguardando', created_at: now });
  });

  // ---------------- WHATSAPP EDGE FUNCTION SIMULATOR ----------------
  app.get('/api/whatsapp/mensagens', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT wm.*, c.nome AS cliente_nome
         FROM whatsapp_mensagens wm
         JOIN agendamentos a ON a.id = wm.agendamento_id
         JOIN clientes c ON c.id = a.cliente_id
         ORDER BY wm.created_at DESC
         LIMIT 30`
      )
      .all();
    res.json(rows);
  });

  app.post('/api/whatsapp/simular', (req, res) => {
    const schema = z.object({
      agendamento_id: z.string().min(1),
      novo_estado: z.enum(['Aguardando Confirmação', 'Confirmado', 'Cancelado']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload de simulação WhatsApp inválido' });
    }
    const { agendamento_id, novo_estado } = parsed.data;

    const ag = db
      .prepare(
        `SELECT a.*, c.nome AS cliente_nome, c.whatsapp AS cliente_whatsapp, p.nome AS procedimento_nome
         FROM agendamentos a
         JOIN clientes c ON c.id = a.cliente_id
         JOIN procedimentos p ON p.id = a.procedimento_id
         WHERE a.id = ? AND a.deleted_at IS NULL`
      )
      .get(agendamento_id) as Record<string, any> | undefined;

    if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const now = new Date().toISOString();
    const novoStatusAgendamento =
      novo_estado === 'Cancelado'
        ? 'cancelado'
        : ag.status === 'cancelado'
        ? 'agendado'
        : ag.status;

    const tx = db.transaction(() => {
      // Se estava cancelado e voltou para ativo, validar conflito antes de reativar
      if (ag.status === 'cancelado' && novoStatusAgendamento === 'agendado') {
        const conflito = db
          .prepare(
            `SELECT id FROM agendamentos
             WHERE id != ?
               AND deleted_at IS NULL
               AND status != 'cancelado'
               AND (profissional_id = ? OR local_id = ?)
               AND data_hora_inicio < ?
               AND data_hora_fim > ?`
          )
          .get(ag.id, ag.profissional_id, ag.local_id, ag.data_hora_fim, ag.data_hora_inicio);
        if (conflito) {
          return {
            error: 'Não foi possível reativar o agendamento: o horário já foi ocupado por outro paciente.',
            status: 409 as const,
          };
        }
      }

      db.prepare(`UPDATE agendamentos SET whatsapp_status = ?, status = ? WHERE id = ?`).run(
        novo_estado,
        novoStatusAgendamento,
        agendamento_id
      );

      let conteudo = '';
      if (novo_estado === 'Confirmado') {
        conteudo = `✅ Presença confirmada automaticamente para ${ag.procedimento_nome} em ${ag.data_hora_inicio
          .slice(0, 10)
          .split('-')
          .reverse()
          .join('/')} às ${ag.data_hora_inicio.slice(11, 16)}.`;
      } else if (novo_estado === 'Cancelado') {
        conteudo = `❌ Agendamento cancelado via WhatsApp. Horário liberado na agenda e notificação enviada à recepção.`;
      } else {
        conteudo = `🔔 Lembrete reenviado: confirme sua consulta de ${ag.procedimento_nome}.`;
      }

      db.prepare(
        `INSERT INTO whatsapp_mensagens (id, agendamento_id, telefone, estado, conteudo, direcao, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        agendamento_id,
        ag.cliente_whatsapp,
        novo_estado,
        conteudo,
        novo_estado === 'Aguardando Confirmação' ? 'enviada' : 'recebida',
        now
      );

      registrarAuditoria(db, {
        usuario: `EdgeFunction:whatsapp-webhook (${getOperator(req)})`,
        acao: `WHATSAPP_${novo_estado.toUpperCase().replace(/\s+/g, '_')}`,
        entidade: 'agendamentos',
        entidade_id: agendamento_id,
        detalhes: { cliente: ag.cliente_nome, novo_estado },
      });

      return { ok: true as const };
    });

    const txResult = tx();
    if ('error' in txResult && txResult.error) {
      return res.status(txResult.status ?? 409).json({ error: txResult.error });
    }

    res.json({
      ok: true,
      agendamento_id,
      whatsapp_status: novo_estado,
      status: novoStatusAgendamento,
    });
  });

  // ---------------- RELATÓRIOS & AUDITORIA ----------------
  app.get('/api/relatorios', (req, res) => {
    const rawFrom = String(req.query.from ?? '2000-01-01');
    const rawTo = String(req.query.to ?? '2099-12-31');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(rawFrom) || !dateRegex.test(rawTo)) {
      return res.status(400).json({ error: 'Parâmetros from e to devem estar no formato YYYY-MM-DD.' });
    }
    const from = rawFrom;
    const to = rawTo;

    const rows = db
      .prepare(
        `SELECT a.*, p.nome AS procedimento_nome
         FROM agendamentos a
         JOIN procedimentos p ON p.id = a.procedimento_id
         WHERE a.deleted_at IS NULL
           AND a.clinica_id = ?
           AND substr(a.data_hora_inicio, 1, 10) >= ?
           AND substr(a.data_hora_inicio, 1, 10) <= ?
         ORDER BY a.data_hora_inicio ASC`
      )
      .all(CLINICA_PADRAO_ID, from, to) as Array<Record<string, any>>;

    const locaisAtivos = db
      .prepare(`SELECT COUNT(*) AS total FROM locais WHERE deleted_at IS NULL AND status = 'ativo' AND clinica_id = ?`)
      .get(CLINICA_PADRAO_ID) as { total: number };
    const capacidadeDiariaMin = Math.max(1, locaisAtivos.total) * 480;

    const total = rows.length;
    const realizados = rows.filter((r) => r.status === 'realizado').length;
    const faltas = rows.filter((r) => r.status === 'falta').length;
    const cancelados = rows.filter((r) => r.status === 'cancelado').length;
    const agendados = rows.filter((r) => r.status === 'agendado').length;
    const receitaRealizada = rows
      .filter((r) => r.status === 'realizado')
      .reduce((acc, r) => acc + Number(r.valor_total || 0), 0);

    // Agrupamento diário de ocupação com capacidade proporcional aos locais ativos
    const byDay = new Map<string, { total: number; minutos: number }>();
    for (const r of rows) {
      if (r.status === 'cancelado') continue;
      const d = String(r.data_hora_inicio).slice(0, 10);
      const cur = byDay.get(d) ?? { total: 0, minutos: 0 };
      cur.total += 1;
      cur.minutos += Number(r.duracao_total_min || 30);
      byDay.set(d, cur);
    }

    const ocupacaoDiaria = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dataStr, info]) => {
        const [, mm, dd] = dataStr.split('-');
        const pct = Math.min(100, Math.round((info.minutos / capacidadeDiariaMin) * 100));
        return {
          data: dataStr,
          label: `${dd}/${mm}`,
          ocupacao_pct: pct,
          atendimentos: info.total,
        };
      });

    const taxaOcupacaoPct =
      ocupacaoDiaria.length > 0
        ? Math.round(ocupacaoDiaria.reduce((acc, d) => acc + d.ocupacao_pct, 0) / ocupacaoDiaria.length)
        : 0;

    // Procedimentos mais realizados
    const procCounts = new Map<string, { quantidade: number; receita: number }>();
    for (const r of rows) {
      if (r.status === 'cancelado') continue;
      const cur = procCounts.get(r.procedimento_nome) ?? { quantidade: 0, receita: 0 };
      cur.quantidade += 1;
      cur.receita += Number(r.valor_total || 0);
      procCounts.set(r.procedimento_nome, cur);
    }

    const procedimentosMaisRealizados = Array.from(procCounts.entries())
      .map(([nome, info]) => ({
        nome: nome.length > 24 ? `${nome.slice(0, 22)}…` : nome,
        quantidade: info.quantidade,
        receita: info.receita,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 6);

    const faltasVsRealizados = [
      { name: 'Realizados', value: realizados, color: '#16A34A' },
      { name: 'Faltas', value: faltas, color: '#DC2626' },
      { name: 'Cancelados', value: cancelados, color: '#94A3B8' },
      { name: 'Agendados', value: agendados, color: '#1E3A8A' },
    ].filter((item) => item.value > 0);

    res.json({
      resumo: {
        total_agendamentos: total,
        realizados,
        faltas,
        cancelados,
        agendados,
        taxa_ocupacao_pct: taxaOcupacaoPct,
        receita_realizada: receitaRealizada,
      },
      ocupacao_diaria: ocupacaoDiaria,
      procedimentos_mais_realizados: procedimentosMaisRealizados,
      faltas_vs_realizados: faltasVsRealizados,
    });
  });

  app.get('/api/logs-auditoria', (req, res) => {
    const parsedLimit = Number(req.query.limit ?? 30);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.trunc(parsedLimit))) : 30;
    const rows = db
      .prepare(
        `SELECT * FROM logs_auditoria WHERE clinica_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(CLINICA_PADRAO_ID, limit);
    res.json(rows);
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[AgendaFlex API Error]', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  });

  // Vite dev middleware or static dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgendaFlex server listening on http://localhost:${PORT}`);
  });
}

startServer();
