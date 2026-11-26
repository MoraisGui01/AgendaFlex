import { z } from 'zod';
import { dataValida, horaValida, paraMinutos } from './horarios.ts';

// Esquemas Zod de tudo o que chega pela API

const hora = z.string().refine(horaValida, 'Horário inválido (use HH:MM entre 00:00 e 23:59).');
const data = (mensagem: string) => z.string().refine(dataValida, mensagem);
const status = z.enum(['ativo', 'inativo']);

export const horarioFuncionamentoSchema = z
  .object({
    abertura: hora,
    fechamento: hora,
    intervalo_inicio: hora.optional(),
    intervalo_fim: hora.optional(),
    dias: z.array(z.number().int().min(0).max(6)).min(1, 'Selecione ao menos um dia de funcionamento.'),
  })
  .refine((h) => paraMinutos(h.fechamento) > paraMinutos(h.abertura), {
    message: 'O fechamento deve ser depois da abertura.',
  })
  .refine((h) => !h.intervalo_inicio || !h.intervalo_fim || paraMinutos(h.intervalo_fim) > paraMinutos(h.intervalo_inicio), {
    message: 'O fim do intervalo deve ser depois do início.',
  });

export const localSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do local.'),
  endereco: z.string().trim().min(5, 'Informe o endereço completo.'),
  horario_func: horarioFuncionamentoSchema,
  status: status.default('ativo'),
});

export const profissionalSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do profissional.'),
  cpf: z.string().trim().refine((v) => v.replace(/\D/g, '').length === 11, 'CPF deve ter 11 dígitos.'),
  registro_conselho: z.string().trim().default(''),
  especialidade: z.string().trim().min(2, 'Informe a especialidade.'),
  procedimentos_vinculados: z.array(z.string()).default([]),
  status: status.default('ativo'),
});

export const clienteSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cliente.'),
  whatsapp: z.string().trim().refine((v) => v.replace(/\D/g, '').length >= 10, 'WhatsApp deve ter DDD e número.'),
  nascimento: data('Data de nascimento inválida.'),
  lgpd_consentimento: z.boolean().default(true),
  status: status.default('ativo'),
});

export const procedimentoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do procedimento.'),
  duracao_min: z.number().int().positive('A duração deve ser maior que zero.'),
  valor: z.number().nonnegative('O valor não pode ser negativo.'),
  orientacoes: z.string().default(''),
  status: status.default('ativo'),
});

export const novoAgendamentoSchema = z.object({
  cliente_id: z.string().min(1, 'Selecione o cliente.'),
  profissional_id: z.string().min(1, 'Selecione o profissional.'),
  local_id: z.string().min(1, 'Selecione o local.'),
  procedimento_id: z.string().min(1, 'Selecione o procedimento.'),
  data_hora_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Data e hora em formato inválido.')
    .refine((v) => dataValida(v.slice(0, 10)) && horaValida(v.slice(11, 16)), 'Data ou horário inexistente.'),
  origem: z.enum(['recepcao', 'whatsapp', 'portal', 'lista_espera']).default('recepcao'),
  observacoes: z.string().default(''),
});

export const statusAgendamentoSchema = z.object({
  status: z.enum(['agendado', 'realizado', 'falta', 'cancelado']),
});

export const extraSchema = z.object({
  procedimento_id: z.string().nullish(),
  nome_procedimento: z.string().trim().min(2, 'Descreva o procedimento extra.'),
  duracao_min: z.number().int().positive('O tempo adicional deve ser maior que zero.'),
  valor: z.number().nonnegative('O valor adicional não pode ser negativo.'),
});

export const listaEsperaSchema = z.object({
  cliente_id: z.string().min(1, 'Selecione o cliente.'),
  profissional_id: z.string().min(1, 'Selecione o profissional.'),
  procedimento_id: z.string().min(1, 'Selecione o procedimento.'),
  local_id: z.string().min(1, 'Selecione o local.'),
  data_desejada: data('Data desejada inválida.'),
  observacoes: z.string().default(''),
});

export const statusListaEsperaSchema = z.object({
  status: z.enum(['aguardando', 'atendido', 'cancelado']),
});

export const estadoWhatsappSchema = z.object({
  agendamento_id: z.string().min(1),
  novo_estado: z.enum(['Aguardando Confirmação', 'Confirmado', 'Cancelado']),
});

export const eventoSessaoSchema = z.object({
  evento: z.enum(['LOGIN_GOOGLE', 'LOGOFF_GOOGLE']),
});

export const periodoSchema = z.object({
  from: data('Data inicial inválida.').default('2000-01-01'),
  to: data('Data final inválida.').default('2099-12-31'),
});
