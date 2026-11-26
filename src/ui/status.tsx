import type { EstadoWhatsapp, StatusAgendamento } from '@/tipos';
import { Selo } from './componentes';

const STATUS: Record<StatusAgendamento, { texto: string; cor: 'azul' | 'verde' | 'vermelho' | 'cinza' }> = {
  agendado: { texto: 'Agendado', cor: 'azul' },
  realizado: { texto: 'Realizado', cor: 'verde' },
  falta: { texto: 'Falta', cor: 'vermelho' },
  cancelado: { texto: 'Cancelado', cor: 'cinza' },
};

const WHATSAPP: Record<EstadoWhatsapp, 'amarelo' | 'verde' | 'vermelho'> = {
  'Aguardando Confirmação': 'amarelo',
  Confirmado: 'verde',
  Cancelado: 'vermelho',
};

export function SeloStatus({ status }: { status: StatusAgendamento }) {
  return <Selo cor={STATUS[status].cor}>{STATUS[status].texto}</Selo>;
}

export function SeloWhatsapp({ estado }: { estado: EstadoWhatsapp }) {
  return <Selo cor={WHATSAPP[estado]}>{estado}</Selo>;
}

export const ORIGENS: Record<string, string> = {
  recepcao: 'Recepção',
  whatsapp: 'WhatsApp',
  portal: 'Portal',
  lista_espera: 'Lista de espera',
};
