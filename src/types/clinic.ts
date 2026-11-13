export type RegistroStatus = 'ativo' | 'inativo';
export type AgendamentoStatus = 'agendado' | 'realizado' | 'falta' | 'cancelado';
export type WhatsAppStatus = 'Aguardando Confirmação' | 'Confirmado' | 'Cancelado';
export type AgendamentoOrigem = 'recepcao' | 'whatsapp' | 'portal' | 'lista_espera';

export interface HorarioFuncionamento {
  abertura: string;
  fechamento: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
  dias: number[];
}

export interface LocalClinica {
  id: string;
  clinica_id: string;
  nome: string;
  endereco: string;
  horario_func: HorarioFuncionamento;
  status: RegistroStatus;
  created_at: string;
  deleted_at: string | null;
}

export interface Profissional {
  id: string;
  clinica_id: string;
  nome: string;
  cpf: string;
  registro_conselho: string;
  especialidade: string;
  status: RegistroStatus;
  procedimentos_vinculados: string[];
  created_at: string;
  deleted_at: string | null;
}

export interface Cliente {
  id: string;
  clinica_id: string;
  nome: string;
  whatsapp: string;
  nascimento: string;
  lgpd_consentimento: boolean;
  lgpd_consentimento_em: string;
  status: RegistroStatus;
  created_at: string;
  deleted_at: string | null;
}

export interface Procedimento {
  id: string;
  clinica_id: string;
  nome: string;
  duracao_min: number;
  valor: number;
  orientacoes: string;
  status: RegistroStatus;
  created_at: string;
  deleted_at: string | null;
}

export interface ProcedimentoExtra {
  id: string;
  agendamento_id: string;
  procedimento_id: string | null;
  nome_procedimento: string;
  duracao_min: number;
  valor: number;
  adicionado_por: string;
  created_at: string;
}

export interface Agendamento {
  id: string;
  clinica_id: string;
  cliente_id: string;
  profissional_id: string;
  local_id: string;
  procedimento_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  status: AgendamentoStatus;
  whatsapp_status: WhatsAppStatus;
  origem: AgendamentoOrigem;
  valor_total: number;
  duracao_total_min: number;
  observacoes: string;
  created_at: string;
  deleted_at: string | null;
  cliente_nome?: string;
  cliente_whatsapp?: string;
  profissional_nome?: string;
  profissional_especialidade?: string;
  local_nome?: string;
  procedimento_nome?: string;
  procedimento_duracao_min?: number;
  procedimento_valor?: number;
  procedimento_orientacoes?: string;
  extras?: ProcedimentoExtra[];
}

export interface SlotDisponivel {
  hora_inicio: string;
  hora_fim: string;
  data_hora_inicio: string;
  data_hora_fim: string;
}

export interface ListaEsperaItem {
  id: string;
  clinica_id: string;
  cliente_id: string;
  profissional_id: string;
  procedimento_id: string;
  local_id: string;
  data_desejada: string;
  observacoes: string;
  status: 'aguardando' | 'atendido' | 'cancelado';
  created_at: string;
  cliente_nome?: string;
  cliente_whatsapp?: string;
  profissional_nome?: string;
  procedimento_nome?: string;
  local_nome?: string;
}

export interface LogAuditoria {
  id: string;
  clinica_id: string;
  usuario: string;
  acao: string;
  entidade: string;
  entidade_id: string;
  detalhes: string;
  created_at: string;
}

export interface WhatsAppMensagem {
  id: string;
  agendamento_id: string;
  cliente_nome?: string;
  telefone: string;
  estado: WhatsAppStatus;
  conteudo: string;
  direcao: 'enviada' | 'recebida';
  created_at: string;
}

export interface RelatorioResponse {
  resumo: {
    total_agendamentos: number;
    realizados: number;
    faltas: number;
    cancelados: number;
    agendados: number;
    taxa_ocupacao_pct: number;
    receita_realizada: number;
  };
  ocupacao_diaria: Array<{
    data: string;
    label: string;
    ocupacao_pct: number;
    atendimentos: number;
  }>;
  procedimentos_mais_realizados: Array<{
    nome: string;
    quantidade: number;
    receita: number;
  }>;
  faltas_vs_realizados: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}
