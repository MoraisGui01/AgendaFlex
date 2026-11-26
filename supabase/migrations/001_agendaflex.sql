-- AgendaFlex: modelo do banco para Supabase (PostgreSQL)
-- Mesmas tabelas usadas pelo servidor, com tipos nativos, isolamento por clínica (RLS),
-- restrições de integridade e proteção contra agendamentos sobrepostos no próprio banco.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE clinicas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  cnpj        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usuários do sistema e o papel de cada um na clínica
CREATE TABLE clinica_usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id  UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  papel       TEXT NOT NULL CHECK (papel IN ('admin', 'recepcao', 'profissional')),
  UNIQUE (clinica_id, user_id)
);

CREATE TABLE locais (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id    UUID NOT NULL REFERENCES clinicas(id),
  nome          TEXT NOT NULL,
  endereco      TEXT NOT NULL,
  horario_func  JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE procedimentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id   UUID NOT NULL REFERENCES clinicas(id),
  nome         TEXT NOT NULL,
  duracao_min  INTEGER NOT NULL CHECK (duracao_min > 0),
  valor        NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
  orientacoes  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE profissionais (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id         UUID NOT NULL REFERENCES clinicas(id),
  nome               TEXT NOT NULL,
  cpf                TEXT NOT NULL,
  registro_conselho  TEXT NOT NULL DEFAULT '',
  especialidade      TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  UNIQUE (clinica_id, cpf)
);

-- Procedimentos que cada profissional realiza (no servidor fica como lista JSON)
CREATE TABLE profissional_procedimentos (
  profissional_id  UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  procedimento_id  UUID NOT NULL REFERENCES procedimentos(id) ON DELETE CASCADE,
  PRIMARY KEY (profissional_id, procedimento_id)
);

CREATE TABLE clientes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id             UUID NOT NULL REFERENCES clinicas(id),
  nome                   TEXT NOT NULL,
  whatsapp               TEXT NOT NULL,
  nascimento             DATE NOT NULL,
  lgpd_consentimento     BOOLEAN NOT NULL,
  lgpd_consentimento_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                 TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);

CREATE TABLE agendamentos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id         UUID NOT NULL REFERENCES clinicas(id),
  cliente_id         UUID NOT NULL REFERENCES clientes(id),
  profissional_id    UUID NOT NULL REFERENCES profissionais(id),
  local_id           UUID NOT NULL REFERENCES locais(id),
  procedimento_id    UUID NOT NULL REFERENCES procedimentos(id),
  data_hora_inicio   TIMESTAMP NOT NULL,
  data_hora_fim      TIMESTAMP NOT NULL,
  status             TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'realizado', 'falta', 'cancelado')),
  whatsapp_status    TEXT NOT NULL DEFAULT 'Aguardando Confirmação'
                     CHECK (whatsapp_status IN ('Aguardando Confirmação', 'Confirmado', 'Cancelado')),
  origem             TEXT NOT NULL DEFAULT 'recepcao' CHECK (origem IN ('recepcao', 'whatsapp', 'portal', 'lista_espera')),
  valor_total        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  duracao_total_min  INTEGER NOT NULL,
  observacoes        TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  CHECK (data_hora_fim > data_hora_inicio),

  -- O próprio banco recusa dois agendamentos ativos sobrepostos para o mesmo profissional ou a mesma sala
  EXCLUDE USING gist (profissional_id WITH =, tsrange(data_hora_inicio, data_hora_fim) WITH &&)
    WHERE (status <> 'cancelado' AND deleted_at IS NULL),
  EXCLUDE USING gist (local_id WITH =, tsrange(data_hora_inicio, data_hora_fim) WITH &&)
    WHERE (status <> 'cancelado' AND deleted_at IS NULL)
);

CREATE TABLE atendimento_procedimentos_extras (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id     UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  procedimento_id    UUID REFERENCES procedimentos(id),
  nome_procedimento  TEXT NOT NULL,
  duracao_min        INTEGER NOT NULL CHECK (duracao_min > 0),
  valor              NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
  adicionado_por     TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lista_espera (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id       UUID NOT NULL REFERENCES clinicas(id),
  cliente_id       UUID NOT NULL REFERENCES clientes(id),
  profissional_id  UUID NOT NULL REFERENCES profissionais(id),
  procedimento_id  UUID NOT NULL REFERENCES procedimentos(id),
  local_id         UUID NOT NULL REFERENCES locais(id),
  data_desejada    DATE NOT NULL,
  observacoes      TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'atendido', 'cancelado')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE whatsapp_mensagens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id  UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  telefone        TEXT NOT NULL,
  estado          TEXT NOT NULL CHECK (estado IN ('Aguardando Confirmação', 'Confirmado', 'Cancelado')),
  conteudo        TEXT NOT NULL,
  direcao         TEXT NOT NULL CHECK (direcao IN ('enviada', 'recebida')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log de auditoria: só recebe inserções (ninguém altera ou apaga)
CREATE TABLE logs_auditoria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id   UUID NOT NULL REFERENCES clinicas(id),
  usuario      TEXT NOT NULL,
  acao         TEXT NOT NULL,
  entidade     TEXT NOT NULL,
  entidade_id  TEXT NOT NULL,
  detalhes     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON agendamentos (data_hora_inicio);
CREATE INDEX ON logs_auditoria (created_at DESC);

-- ---------------------------------------------------------------- Row Level Security
-- Cada usuário só enxerga os dados da(s) clínica(s) a que pertence.

CREATE FUNCTION minhas_clinicas() RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT clinica_id FROM clinica_usuarios WHERE user_id = auth.uid()
$$;

DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['locais', 'procedimentos', 'profissionais', 'clientes', 'agendamentos', 'lista_espera'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (clinica_id IN (SELECT minhas_clinicas())) WITH CHECK (clinica_id IN (SELECT minhas_clinicas()))',
      'acesso_clinica_' || tabela, tabela
    );
  END LOOP;
END $$;

ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY ler_auditoria ON logs_auditoria FOR SELECT USING (clinica_id IN (SELECT minhas_clinicas()));
CREATE POLICY gravar_auditoria ON logs_auditoria FOR INSERT WITH CHECK (clinica_id IN (SELECT minhas_clinicas()));
-- Sem políticas de UPDATE/DELETE: o log não pode ser alterado
