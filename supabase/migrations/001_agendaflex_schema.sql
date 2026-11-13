-- AgendaFlex: Schema Supabase PostgreSQL com RLS estrito, Check Constraints, Soft Deletes e Auditoria LGPD

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Clínicas (Tenant isolation para RLS)
CREATE TABLE IF NOT EXISTS public.clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membros / Usuários da clínica (para validação RLS via auth.uid())
CREATE TABLE IF NOT EXISTS public.clinica_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('admin', 'profissional', 'recepcao')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinica_id, user_id)
);

-- 1. Locais / Unidades e Salas de Atendimento
CREATE TABLE IF NOT EXISTS public.locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  horario_func JSONB NOT NULL DEFAULT '{"abertura": "08:00", "fechamento": "18:00", "dias": [1,2,3,4,5]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- 2. Profissionais
CREATE TABLE IF NOT EXISTS public.profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  registro_conselho TEXT NOT NULL DEFAULT '',
  especialidade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  procedimentos_vinculados UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- 3. Clientes / Pacientes (Conformidade LGPD)
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  nascimento DATE NOT NULL,
  lgpd_consentimento BOOLEAN NOT NULL DEFAULT true,
  lgpd_consentimento_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- 4. Procedimentos
CREATE TABLE IF NOT EXISTS public.procedimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
  orientacoes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- 5. Agendamentos (Com exclusão de sobreposição por profissional e local)
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id),
  local_id UUID NOT NULL REFERENCES public.locais(id),
  procedimento_id UUID NOT NULL REFERENCES public.procedimentos(id),
  data_hora_inicio TIMESTAMPTZ NOT NULL,
  data_hora_fim TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'realizado', 'falta', 'cancelado')),
  whatsapp_status TEXT NOT NULL DEFAULT 'Aguardando Confirmação' CHECK (whatsapp_status IN ('Aguardando Confirmação', 'Confirmado', 'Cancelado')),
  origem TEXT NOT NULL DEFAULT 'recepcao' CHECK (origem IN ('recepcao', 'whatsapp', 'portal', 'lista_espera')),
  valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  duracao_total_min INTEGER NOT NULL DEFAULT 30,
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_agendamento_intervalo CHECK (data_hora_fim > data_hora_inicio)
);

-- Garantia em nível de banco contra conflitos simultâneos
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS excl_profissional_horario,
  ADD CONSTRAINT excl_profissional_horario EXCLUDE USING gist (
    profissional_id WITH =,
    tstzrange(data_hora_inicio, data_hora_fim) WITH &&
  ) WHERE (deleted_at IS NULL AND status <> 'cancelado');

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS excl_local_horario,
  ADD CONSTRAINT excl_local_horario EXCLUDE USING gist (
    local_id WITH =,
    tstzrange(data_hora_inicio, data_hora_fim) WITH &&
  ) WHERE (deleted_at IS NULL AND status <> 'cancelado');

-- 6. Procedimentos Extras em Atendimento
CREATE TABLE IF NOT EXISTS public.atendimento_procedimentos_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  procedimento_id UUID NULL REFERENCES public.procedimentos(id),
  nome_procedimento TEXT NOT NULL,
  duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
  adicionado_por TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Lista de Espera
CREATE TABLE IF NOT EXISTS public.lista_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id),
  procedimento_id UUID NOT NULL REFERENCES public.procedimentos(id),
  local_id UUID NOT NULL REFERENCES public.locais(id),
  data_desejada DATE NOT NULL,
  observacoes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'atendido', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Logs de Auditoria (Rastreabilidade LGPD)
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  usuario TEXT NOT NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Função auxiliar para verificar pertencimento à clínica no RLS
CREATE OR REPLACE FUNCTION public.usuario_pertence_clinica(target_clinica_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinica_usuarios cu
    WHERE cu.clinica_id = target_clinica_id
      AND cu.user_id = auth.uid()
  );
$$;

-- Habilitar RLS estrito em todas as tabelas (incluindo clinicas e vínculos)
ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinica_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_procedimentos_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS isolando os dados de cada clínica sem quebrar joins históricos de soft-delete
CREATE POLICY "rls_clinicas_leitura" ON public.clinicas
  FOR SELECT USING (public.usuario_pertence_clinica(id));

CREATE POLICY "rls_clinica_usuarios_proprio" ON public.clinica_usuarios
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "rls_locais_clinica" ON public.locais
  FOR ALL USING (public.usuario_pertence_clinica(clinica_id))
  WITH CHECK (public.usuario_pertence_clinica(clinica_id));

CREATE POLICY "rls_profissionais_clinica" ON public.profissionais
  FOR ALL USING (public.usuario_pertence_clinica(clinica_id))
  WITH CHECK (public.usuario_pertence_clinica(clinica_id));

CREATE POLICY "rls_clientes_clinica" ON public.clientes
  FOR ALL USING (public.usuario_pertence_clinica(clinica_id))
  WITH CHECK (public.usuario_pertence_clinica(clinica_id));

CREATE POLICY "rls_procedimentos_clinica" ON public.procedimentos
  FOR ALL USING (public.usuario_pertence_clinica(clinica_id))
  WITH CHECK (public.usuario_pertence_clinica(clinica_id));

CREATE POLICY "rls_agendamentos_clinica" ON public.agendamentos
  FOR ALL USING (public.usuario_pertence_clinica(clinica_id) AND deleted_at IS NULL)
  WITH CHECK (public.usuario_pertence_clinica(clinica_id));

CREATE POLICY "rls_extras_clinica" ON public.atendimento_procedimentos_extras
  FOR ALL USING (public.usuario_pertence_clinica(clinica_id))
  WITH CHECK (public.usuario_pertence_clinica(clinica_id));

CREATE POLICY "rls_lista_espera_clinica" ON public.lista_espera
  FOR ALL USING (public.usuario_pertence_clinica(clinica_id))
  WITH CHECK (public.usuario_pertence_clinica(clinica_id));

CREATE POLICY "rls_logs_auditoria_leitura" ON public.logs_auditoria
  FOR SELECT USING (public.usuario_pertence_clinica(clinica_id));

CREATE POLICY "rls_logs_auditoria_insercao" ON public.logs_auditoria
  FOR INSERT WITH CHECK (public.usuario_pertence_clinica(clinica_id));
