import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';

const DB_PATH = path.resolve(process.cwd(), 'agendaflex.db');

export const CLINICA_PADRAO_ID = 'clinica-paulista-01';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initSchema(dbInstance);
    seedIfEmpty(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clinicas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      cnpj TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locais (
      id TEXT PRIMARY KEY,
      clinica_id TEXT NOT NULL REFERENCES clinicas(id),
      nome TEXT NOT NULL,
      endereco TEXT NOT NULL,
      horario_func TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      created_at TEXT NOT NULL,
      deleted_at TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS profissionais (
      id TEXT PRIMARY KEY,
      clinica_id TEXT NOT NULL REFERENCES clinicas(id),
      nome TEXT NOT NULL,
      cpf TEXT NOT NULL,
      registro_conselho TEXT NOT NULL DEFAULT '',
      especialidade TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      procedimentos_vinculados TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      deleted_at TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      clinica_id TEXT NOT NULL REFERENCES clinicas(id),
      nome TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      nascimento TEXT NOT NULL,
      lgpd_consentimento INTEGER NOT NULL DEFAULT 1 CHECK (lgpd_consentimento IN (0, 1)),
      lgpd_consentimento_em TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      created_at TEXT NOT NULL,
      deleted_at TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS procedimentos (
      id TEXT PRIMARY KEY,
      clinica_id TEXT NOT NULL REFERENCES clinicas(id),
      nome TEXT NOT NULL,
      duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),
      valor REAL NOT NULL CHECK (valor >= 0),
      orientacoes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      created_at TEXT NOT NULL,
      deleted_at TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS agendamentos (
      id TEXT PRIMARY KEY,
      clinica_id TEXT NOT NULL REFERENCES clinicas(id),
      cliente_id TEXT NOT NULL REFERENCES clientes(id),
      profissional_id TEXT NOT NULL REFERENCES profissionais(id),
      local_id TEXT NOT NULL REFERENCES locais(id),
      procedimento_id TEXT NOT NULL REFERENCES procedimentos(id),
      data_hora_inicio TEXT NOT NULL,
      data_hora_fim TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'realizado', 'falta', 'cancelado')),
      whatsapp_status TEXT NOT NULL DEFAULT 'Aguardando Confirmação' CHECK (whatsapp_status IN ('Aguardando Confirmação', 'Confirmado', 'Cancelado')),
      origem TEXT NOT NULL DEFAULT 'recepcao' CHECK (origem IN ('recepcao', 'whatsapp', 'portal', 'lista_espera')),
      valor_total REAL NOT NULL DEFAULT 0,
      duracao_total_min INTEGER NOT NULL DEFAULT 30,
      observacoes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      CHECK (data_hora_fim > data_hora_inicio)
    );

    CREATE TABLE IF NOT EXISTS atendimento_procedimentos_extras (
      id TEXT PRIMARY KEY,
      agendamento_id TEXT NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
      procedimento_id TEXT NULL REFERENCES procedimentos(id),
      nome_procedimento TEXT NOT NULL,
      duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),
      valor REAL NOT NULL CHECK (valor >= 0),
      adicionado_por TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lista_espera (
      id TEXT PRIMARY KEY,
      clinica_id TEXT NOT NULL REFERENCES clinicas(id),
      cliente_id TEXT NOT NULL REFERENCES clientes(id),
      profissional_id TEXT NOT NULL REFERENCES profissionais(id),
      procedimento_id TEXT NOT NULL REFERENCES procedimentos(id),
      local_id TEXT NOT NULL REFERENCES locais(id),
      data_desejada TEXT NOT NULL,
      observacoes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'atendido', 'cancelado')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs_auditoria (
      id TEXT PRIMARY KEY,
      clinica_id TEXT NOT NULL REFERENCES clinicas(id),
      usuario TEXT NOT NULL,
      acao TEXT NOT NULL,
      entidade TEXT NOT NULL,
      entidade_id TEXT NOT NULL,
      detalhes TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
      id TEXT PRIMARY KEY,
      agendamento_id TEXT NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
      telefone TEXT NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('Aguardando Confirmação', 'Confirmado', 'Cancelado')),
      conteudo TEXT NOT NULL,
      direcao TEXT NOT NULL CHECK (direcao IN ('enviada', 'recebida')),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agendamentos_inicio ON agendamentos(data_hora_inicio);
    CREATE INDEX IF NOT EXISTS idx_agendamentos_prof ON agendamentos(profissional_id);
    CREATE INDEX IF NOT EXISTS idx_agendamentos_local ON agendamentos(local_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON logs_auditoria(created_at DESC);
  `);
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(base: Date, delta: number): Date {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function addMinutesToTime(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export function registrarAuditoria(
  db: Database.Database,
  params: {
    clinica_id?: string;
    usuario: string;
    acao: string;
    entidade: string;
    entidade_id: string;
    detalhes?: Record<string, unknown>;
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO logs_auditoria (id, clinica_id, usuario, acao, entidade, entidade_id, detalhes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    crypto.randomUUID(),
    params.clinica_id ?? CLINICA_PADRAO_ID,
    params.usuario || 'Admin Clínica',
    params.acao,
    params.entidade,
    params.entidade_id,
    JSON.stringify(params.detalhes ?? {}),
    new Date().toISOString()
  );
}

function seedIfEmpty(db: Database.Database): void {
  const existing = db.prepare('SELECT COUNT(*) as total FROM clinicas').get() as { total: number };
  if (existing.total > 0) return;

  const now = new Date().toISOString();
  const today = new Date();

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO clinicas (id, nome, cnpj, created_at) VALUES (?, ?, ?, ?)').run(
      CLINICA_PADRAO_ID,
      'Clínica Paulista Integrada',
      '27.491.380/0001-52',
      now
    );

    const locais = [
      {
        id: 'loc-paulista-01',
        nome: 'Unidade Paulista · Consultório 01',
        endereco: 'Av. Paulista, 1420 - Conj. 402, Bela Vista, São Paulo - SP',
        horario_func: JSON.stringify({
          abertura: '08:00',
          fechamento: '18:00',
          intervalo_inicio: '12:00',
          intervalo_fim: '13:00',
          dias: [1, 2, 3, 4, 5],
        }),
        status: 'ativo',
      },
      {
        id: 'loc-paulista-proc',
        nome: 'Unidade Paulista · Sala de Procedimentos',
        endereco: 'Av. Paulista, 1420 - Conj. 405, Bela Vista, São Paulo - SP',
        horario_func: JSON.stringify({
          abertura: '08:00',
          fechamento: '19:00',
          intervalo_inicio: '12:30',
          intervalo_fim: '13:30',
          dias: [1, 2, 3, 4, 5, 6],
        }),
        status: 'ativo',
      },
      {
        id: 'loc-moema-02',
        nome: 'Unidade Moema · Consultório 02',
        endereco: 'Al. dos Maracatins, 780 - Moema, São Paulo - SP',
        horario_func: JSON.stringify({
          abertura: '09:00',
          fechamento: '17:00',
          intervalo_inicio: '12:00',
          intervalo_fim: '13:00',
          dias: [1, 2, 3, 4, 5],
        }),
        status: 'ativo',
      },
    ];

    const insertLocal = db.prepare(`
      INSERT INTO locais (id, clinica_id, nome, endereco, horario_func, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of locais) {
      insertLocal.run(l.id, CLINICA_PADRAO_ID, l.nome, l.endereco, l.horario_func, l.status, now);
    }

    const procedimentos = [
      {
        id: 'proc-dermato',
        nome: 'Consulta Dermatológica Clínica',
        duracao_min: 45,
        valor: 380,
        orientacoes: 'Não aplicar maquiagem, filtro solar com cor ou ácidos nas 24h anteriores.',
        status: 'ativo',
      },
      {
        id: 'proc-cardio',
        nome: 'Avaliação Cardiológica + ECG',
        duracao_min: 60,
        valor: 490,
        orientacoes: 'Trazer exames laboratoriais dos últimos 6 meses e lista de medicações contínuas.',
        status: 'ativo',
      },
      {
        id: 'proc-fisio',
        nome: 'Fisioterapia Ortopédica',
        duracao_min: 45,
        valor: 220,
        orientacoes: 'Comparecer com vestimenta leve e confortável para avaliação articular.',
        status: 'ativo',
      },
      {
        id: 'proc-biopsia',
        nome: 'Pequeno Procedimento / Biópsia',
        duracao_min: 30,
        valor: 420,
        orientacoes: 'Informar alergia a anestésicos locais e uso de anticoagulantes.',
        status: 'ativo',
      },
      {
        id: 'proc-retorno',
        nome: 'Retorno Clínico (Pós-Exames)',
        duracao_min: 30,
        valor: 180,
        orientacoes: 'Apresentar laudos originais solicitados na consulta inicial.',
        status: 'ativo',
      },
      {
        id: 'proc-laser',
        nome: 'Sessão de Laser Terapêutico',
        duracao_min: 30,
        valor: 310,
        orientacoes: 'Evitar exposição solar direta por 72h antes e após a sessão.',
        status: 'ativo',
      },
    ];

    const insertProc = db.prepare(`
      INSERT INTO procedimentos (id, clinica_id, nome, duracao_min, valor, orientacoes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of procedimentos) {
      insertProc.run(p.id, CLINICA_PADRAO_ID, p.nome, p.duracao_min, p.valor, p.orientacoes, p.status, now);
    }

    const profissionais = [
      {
        id: 'prof-helena',
        nome: 'Dra. Helena Vasconcelos',
        cpf: '384.219.450-12',
        registro_conselho: 'CRM-SP 148.920',
        especialidade: 'Dermatologia',
        status: 'ativo',
        procedimentos_vinculados: JSON.stringify(['proc-dermato', 'proc-biopsia', 'proc-retorno', 'proc-laser']),
      },
      {
        id: 'prof-rafael',
        nome: 'Dr. Rafael Nogueira',
        cpf: '412.883.190-44',
        registro_conselho: 'CRM-SP 172.305',
        especialidade: 'Cardiologia',
        status: 'ativo',
        procedimentos_vinculados: JSON.stringify(['proc-cardio', 'proc-retorno']),
      },
      {
        id: 'prof-bruno',
        nome: 'Ft. Bruno Cavalcanti',
        cpf: '298.541.770-09',
        registro_conselho: 'CREFITO-3 219.440',
        especialidade: 'Fisioterapia',
        status: 'ativo',
        procedimentos_vinculados: JSON.stringify(['proc-fisio']),
      },
      {
        id: 'prof-marina',
        nome: 'Dra. Marina Alencar',
        cpf: '467.120.880-33',
        registro_conselho: 'CRM-SP 195.612',
        especialidade: 'Clínica Médica',
        status: 'ativo',
        procedimentos_vinculados: JSON.stringify(['proc-retorno', 'proc-biopsia', 'proc-dermato']),
      },
    ];

    const insertProf = db.prepare(`
      INSERT INTO profissionais (id, clinica_id, nome, cpf, registro_conselho, especialidade, status, procedimentos_vinculados, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const pr of profissionais) {
      insertProf.run(
        pr.id,
        CLINICA_PADRAO_ID,
        pr.nome,
        pr.cpf,
        pr.registro_conselho,
        pr.especialidade,
        pr.status,
        pr.procedimentos_vinculados,
        now
      );
    }

    const clientes = [
      { id: 'cli-beatriz', nome: 'Beatriz Almeida Prado', whatsapp: '(11) 98421-3309', nascimento: '1988-04-12', status: 'ativo' },
      { id: 'cli-lucas', nome: 'Lucas Henrique Ferreira', whatsapp: '(11) 97214-8820', nascimento: '1979-09-25', status: 'ativo' },
      { id: 'cli-fernanda', nome: 'Fernanda Costa Ribeiro', whatsapp: '(11) 99104-5518', nascimento: '1993-01-19', status: 'ativo' },
      { id: 'cli-rodrigo', nome: 'Rodrigo Souza Mendes', whatsapp: '(11) 96338-1204', nascimento: '1965-11-03', status: 'ativo' },
      { id: 'cli-camila', nome: 'Camila Duarte Silveira', whatsapp: '(11) 98872-4410', nascimento: '1991-07-28', status: 'ativo' },
      { id: 'cli-eduardo', nome: 'Eduardo Martins Lopes', whatsapp: '(11) 97550-9012', nascimento: '1982-03-14', status: 'ativo' },
      { id: 'cli-patricia', nome: 'Patrícia Gomes Nóbrega', whatsapp: '(11) 99412-6740', nascimento: '1974-12-08', status: 'ativo' },
      { id: 'cli-thiago', nome: 'Thiago Barbosa Vieira', whatsapp: '(11) 96120-3985', nascimento: '1996-06-22', status: 'inativo' },
    ];

    const insertCli = db.prepare(`
      INSERT INTO clientes (id, clinica_id, nome, whatsapp, nascimento, lgpd_consentimento, lgpd_consentimento_em, status, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    for (const c of clientes) {
      insertCli.run(c.id, CLINICA_PADRAO_ID, c.nome, c.whatsapp, c.nascimento, now, c.status, now);
    }

    const procLookup = new Map(procedimentos.map((p) => [p.id, p]));

    const agendaSeeds: Array<{
      id: string;
      dayOffset: number;
      hora: string;
      cliente_id: string;
      profissional_id: string;
      local_id: string;
      procedimento_id: string;
      status: 'agendado' | 'realizado' | 'falta' | 'cancelado';
      whatsapp_status: 'Aguardando Confirmação' | 'Confirmado' | 'Cancelado';
      origem: 'recepcao' | 'whatsapp' | 'portal' | 'lista_espera';
      obs?: string;
    }> = [
      // Hoje (dia 0)
      {
        id: 'ag-hoje-01',
        dayOffset: 0,
        hora: '08:30',
        cliente_id: 'cli-beatriz',
        profissional_id: 'prof-helena',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-dermato',
        status: 'realizado',
        whatsapp_status: 'Confirmado',
        origem: 'whatsapp',
        obs: 'Queixa de sensibilidade cutânea pós-verão.',
      },
      {
        id: 'ag-hoje-02',
        dayOffset: 0,
        hora: '09:30',
        cliente_id: 'cli-rodrigo',
        profissional_id: 'prof-rafael',
        local_id: 'loc-moema-02',
        procedimento_id: 'proc-cardio',
        status: 'agendado',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
        obs: 'Check-up anual preventivo.',
      },
      {
        id: 'ag-hoje-03',
        dayOffset: 0,
        hora: '10:00',
        cliente_id: 'cli-fernanda',
        profissional_id: 'prof-helena',
        local_id: 'loc-paulista-proc',
        procedimento_id: 'proc-laser',
        status: 'agendado',
        whatsapp_status: 'Aguardando Confirmação',
        origem: 'portal',
        obs: '2ª sessão de protocolo dermatológico.',
      },
      {
        id: 'ag-hoje-04',
        dayOffset: 0,
        hora: '11:00',
        cliente_id: 'cli-lucas',
        profissional_id: 'prof-bruno',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-fisio',
        status: 'agendado',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
        obs: 'Reabilitação de manguito rotador.',
      },
      {
        id: 'ag-hoje-05',
        dayOffset: 0,
        hora: '14:00',
        cliente_id: 'cli-camila',
        profissional_id: 'prof-marina',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-retorno',
        status: 'agendado',
        whatsapp_status: 'Aguardando Confirmação',
        origem: 'whatsapp',
        obs: 'Avaliação de hemograma e ferritina.',
      },
      {
        id: 'ag-hoje-06',
        dayOffset: 0,
        hora: '15:00',
        cliente_id: 'cli-eduardo',
        profissional_id: 'prof-helena',
        local_id: 'loc-paulista-proc',
        procedimento_id: 'proc-biopsia',
        status: 'agendado',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
        obs: 'Exérese de lesão benigna dorsal.',
      },
      // Amanhã (dia +1)
      {
        id: 'ag-amanha-01',
        dayOffset: 1,
        hora: '09:00',
        cliente_id: 'cli-patricia',
        profissional_id: 'prof-rafael',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-cardio',
        status: 'agendado',
        whatsapp_status: 'Aguardando Confirmação',
        origem: 'recepcao',
      },
      {
        id: 'ag-amanha-02',
        dayOffset: 1,
        hora: '10:30',
        cliente_id: 'cli-beatriz',
        profissional_id: 'prof-helena',
        local_id: 'loc-paulista-proc',
        procedimento_id: 'proc-laser',
        status: 'agendado',
        whatsapp_status: 'Confirmado',
        origem: 'whatsapp',
      },
      // Histórico recente (-1 a -10 dias) para Relatórios e Prontuário
      {
        id: 'ag-hist-01',
        dayOffset: -1,
        hora: '09:00',
        cliente_id: 'cli-beatriz',
        profissional_id: 'prof-helena',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-retorno',
        status: 'realizado',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
        obs: 'Evolução satisfatória com fotoprotetor.',
      },
      {
        id: 'ag-hist-02',
        dayOffset: -1,
        hora: '10:30',
        cliente_id: 'cli-lucas',
        profissional_id: 'prof-bruno',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-fisio',
        status: 'falta',
        whatsapp_status: 'Aguardando Confirmação',
        origem: 'portal',
        obs: 'Paciente não compareceu nem respondeu confirmação.',
      },
      {
        id: 'ag-hist-03',
        dayOffset: -2,
        hora: '14:00',
        cliente_id: 'cli-rodrigo',
        profissional_id: 'prof-rafael',
        local_id: 'loc-moema-02',
        procedimento_id: 'proc-cardio',
        status: 'realizado',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
      },
      {
        id: 'ag-hist-04',
        dayOffset: -2,
        hora: '16:00',
        cliente_id: 'cli-fernanda',
        profissional_id: 'prof-helena',
        local_id: 'loc-paulista-proc',
        procedimento_id: 'proc-laser',
        status: 'realizado',
        whatsapp_status: 'Confirmado',
        origem: 'whatsapp',
      },
      {
        id: 'ag-hist-05',
        dayOffset: -3,
        hora: '09:30',
        cliente_id: 'cli-camila',
        profissional_id: 'prof-marina',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-dermato',
        status: 'cancelado',
        whatsapp_status: 'Cancelado',
        origem: 'whatsapp',
        obs: 'Cancelado pela paciente via WhatsApp com 12h de antecedência.',
      },
      {
        id: 'ag-hist-06',
        dayOffset: -4,
        hora: '11:00',
        cliente_id: 'cli-eduardo',
        profissional_id: 'prof-helena',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-dermato',
        status: 'realizado',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
      },
      {
        id: 'ag-hist-07',
        dayOffset: -5,
        hora: '15:00',
        cliente_id: 'cli-patricia',
        profissional_id: 'prof-rafael',
        local_id: 'loc-moema-02',
        procedimento_id: 'proc-retorno',
        status: 'realizado',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
      },
      {
        id: 'ag-hist-08',
        dayOffset: -6,
        hora: '08:30',
        cliente_id: 'cli-beatriz',
        profissional_id: 'prof-helena',
        local_id: 'loc-paulista-proc',
        procedimento_id: 'proc-biopsia',
        status: 'realizado',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
      },
      {
        id: 'ag-hist-09',
        dayOffset: -7,
        hora: '10:00',
        cliente_id: 'cli-rodrigo',
        profissional_id: 'prof-bruno',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-fisio',
        status: 'falta',
        whatsapp_status: 'Confirmado',
        origem: 'recepcao',
      },
      {
        id: 'ag-hist-10',
        dayOffset: -8,
        hora: '14:30',
        cliente_id: 'cli-fernanda',
        profissional_id: 'prof-marina',
        local_id: 'loc-paulista-01',
        procedimento_id: 'proc-retorno',
        status: 'realizado',
        whatsapp_status: 'Confirmado',
        origem: 'portal',
      },
    ];

    const insertAg = db.prepare(`
      INSERT INTO agendamentos (
        id, clinica_id, cliente_id, profissional_id, local_id, procedimento_id,
        data_hora_inicio, data_hora_fim, status, whatsapp_status, origem,
        valor_total, duracao_total_min, observacoes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMsg = db.prepare(`
      INSERT INTO whatsapp_mensagens (id, agendamento_id, telefone, estado, conteudo, direcao, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const cliLookup = new Map(clientes.map((c) => [c.id, c]));

    for (const ag of agendaSeeds) {
      const proc = procLookup.get(ag.procedimento_id)!;
      const dateStr = toLocalDateStr(addDays(today, ag.dayOffset));
      const endTime = addMinutesToTime(ag.hora, proc.duracao_min);
      const startIso = `${dateStr}T${ag.hora}:00`;
      const endIso = `${dateStr}T${endTime}:00`;
      insertAg.run(
        ag.id,
        CLINICA_PADRAO_ID,
        ag.cliente_id,
        ag.profissional_id,
        ag.local_id,
        ag.procedimento_id,
        startIso,
        endIso,
        ag.status,
        ag.whatsapp_status,
        ag.origem,
        proc.valor,
        proc.duracao_min,
        ag.obs ?? '',
        now
      );

      const cli = cliLookup.get(ag.cliente_id)!;
      insertMsg.run(
        crypto.randomUUID(),
        ag.id,
        cli.whatsapp,
        ag.whatsapp_status,
        `Olá ${cli.nome.split(' ')[0]}, seu agendamento de ${proc.nome} está marcado para ${dateStr.split('-').reverse().join('/')} às ${ag.hora}.`,
        'enviada',
        now
      );
    }

    // Procedimento extra já registrado em um atendimento realizado de hoje para demonstração
    db.prepare(`
      INSERT INTO atendimento_procedimentos_extras (id, agendamento_id, procedimento_id, nome_procedimento, duracao_min, valor, adicionado_por, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'extra-01',
      'ag-hoje-01',
      'proc-laser',
      'Sessão de Laser Terapêutico (Extra)',
      30,
      310,
      'Dra. Helena Vasconcelos',
      now
    );
    db.prepare(`
      UPDATE agendamentos SET valor_total = 690, duracao_total_min = 75 WHERE id = 'ag-hoje-01'
    `).run();

    // Lista de espera exemplo
    db.prepare(`
      INSERT INTO lista_espera (id, clinica_id, cliente_id, profissional_id, procedimento_id, local_id, data_desejada, observacoes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aguardando', ?)
    `).run(
      'wait-01',
      CLINICA_PADRAO_ID,
      'cli-patricia',
      'prof-helena',
      'proc-dermato',
      'loc-paulista-01',
      toLocalDateStr(today),
      'Preferência por encaixe no período da tarde.',
      now
    );

    // Logs de auditoria iniciais
    registrarAuditoria(db, {
      usuario: 'Dra. Camila Mendes (Admin)',
      acao: 'CRIACAO_REGISTRO',
      entidade: 'agendamentos',
      entidade_id: 'ag-hoje-01',
      detalhes: { origem: 'whatsapp', lgpd_consentimento: true },
    });
    registrarAuditoria(db, {
      usuario: 'Dra. Helena Vasconcelos',
      acao: 'PROCEDIMENTO_EXTRA_ADICIONADO',
      entidade: 'agendamentos',
      entidade_id: 'ag-hoje-01',
      detalhes: { extra: 'Sessão de Laser Terapêutico', valor_adicional: 310 },
    });
    registrarAuditoria(db, {
      usuario: 'EdgeFunction:whatsapp-webhook',
      acao: 'WHATSAPP_CANCELADO',
      entidade: 'agendamentos',
      entidade_id: 'ag-hist-05',
      detalhes: { cliente: 'Camila Duarte Silveira' },
    });
  });

  tx();
}
