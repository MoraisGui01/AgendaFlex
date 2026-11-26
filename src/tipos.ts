// Formato dos dados que a API devolve

export type StatusCadastro = 'ativo' | 'inativo';
export type StatusAgendamento = 'agendado' | 'realizado' | 'falta' | 'cancelado';
export type EstadoWhatsapp = 'Aguardando Confirmação' | 'Confirmado' | 'Cancelado';
export type Origem = 'recepcao' | 'whatsapp' | 'portal' | 'lista_espera';

interface Registro {
  id: string;
  status: StatusCadastro;
  created_at: string;
}

export interface HorarioFuncionamento {
  abertura: string;
  fechamento: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
  dias: number[];
}

export interface Local extends Registro {
  nome: string;
  endereco: string;
  horario_func: HorarioFuncionamento;
}

export interface Profissional extends Registro {
  nome: string;
  cpf: string;
  registro_conselho: string;
  especialidade: string;
  procedimentos_vinculados: string[];
}

export interface Cliente extends Registro {
  nome: string;
  whatsapp: string;
  nascimento: string;
  lgpd_consentimento: boolean;
  lgpd_consentimento_em: string;
}

export interface Procedimento extends Registro {
  nome: string;
  duracao_min: number;
  valor: number;
  orientacoes: string;
}

export interface Extra {
  id: string;
  procedimento_id: string | null;
  nome_procedimento: string;
  duracao_min: number;
  valor: number;
  adicionado_por: string;
  created_at: string;
}

export interface Agendamento {
  id: string;
  cliente_id: string;
  profissional_id: string;
  local_id: string;
  procedimento_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  status: StatusAgendamento;
  whatsapp_status: EstadoWhatsapp;
  origem: Origem;
  valor_total: number;
  duracao_total_min: number;
  observacoes: string;
  cliente_nome: string;
  cliente_whatsapp: string;
  profissional_nome: string;
  profissional_especialidade: string;
  local_nome: string;
  procedimento_nome: string;
  procedimento_valor: number;
  procedimento_duracao_min: number;
  procedimento_orientacoes: string;
  extras: Extra[];
}

export interface HorarioLivre {
  hora_inicio: string;
  hora_fim: string;
  data_hora_inicio: string;
}

export interface PedidoEspera {
  id: string;
  cliente_id: string;
  profissional_id: string;
  procedimento_id: string;
  local_id: string;
  data_desejada: string;
  observacoes: string;
  status: 'aguardando' | 'atendido' | 'cancelado';
  cliente_nome: string;
  cliente_whatsapp: string;
  profissional_nome: string;
  procedimento_nome: string;
  local_nome: string;
}

export interface MensagemWhatsapp {
  id: string;
  agendamento_id: string;
  cliente_nome: string;
  telefone: string;
  estado: EstadoWhatsapp;
  conteudo: string;
  direcao: 'enviada' | 'recebida';
  created_at: string;
}

export interface LogAuditoria {
  id: string;
  usuario: string;
  acao: string;
  entidade: string;
  entidade_id: string;
  detalhes: string;
  created_at: string;
}

export interface Relatorio {
  resumo: {
    total_agendamentos: number;
    realizados: number;
    faltas: number;
    cancelados: number;
    agendados: number;
    taxa_ocupacao_pct: number;
    receita_realizada: number;
  };
  ocupacao_diaria: Array<{ data: string; label: string; ocupacao_pct: number; atendimentos: number }>;
  procedimentos_mais_realizados: Array<{ nome: string; quantidade: number; receita: number }>;
  faltas_vs_realizados: Array<{ name: string; value: number; color: string }>;
}
