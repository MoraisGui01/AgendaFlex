import type { Banco } from './conexao.ts';

/**
 * Cria as tabelas se ainda não existirem.
 * Os nomes e colunas são os mesmos das versões anteriores, então um banco já populado continua funcionando.
 * Datas ficam como texto ISO ("2026-11-26T14:30:00") nos dois bancos.
 */
export async function criarEsquema(banco: Banco): Promise<void> {
  const decimal = banco.tipo === 'postgres' ? 'DOUBLE PRECISION' : 'REAL';
  const status = `status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'))`;
  const estadosWhatsapp = `('Aguardando Confirmação', 'Confirmado', 'Cancelado')`;

  await banco.script(`
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
      ${status},
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
      ${status},
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
      ${status},
      created_at TEXT NOT NULL,
      deleted_at TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS procedimentos (
      id TEXT PRIMARY KEY,
      clinica_id TEXT NOT NULL REFERENCES clinicas(id),
      nome TEXT NOT NULL,
      duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),
      valor ${decimal} NOT NULL CHECK (valor >= 0),
      orientacoes TEXT NOT NULL DEFAULT '',
      ${status},
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
      whatsapp_status TEXT NOT NULL DEFAULT 'Aguardando Confirmação' CHECK (whatsapp_status IN ${estadosWhatsapp}),
      origem TEXT NOT NULL DEFAULT 'recepcao' CHECK (origem IN ('recepcao', 'whatsapp', 'portal', 'lista_espera')),
      valor_total ${decimal} NOT NULL DEFAULT 0,
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
      valor ${decimal} NOT NULL CHECK (valor >= 0),
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
      estado TEXT NOT NULL CHECK (estado IN ${estadosWhatsapp}),
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
