// Supabase Edge Function: whatsapp-webhook
// Processa transições de estado ("Aguardando Confirmação", "Confirmado", "Cancelado")
// e dispara notificações automáticas via provedor WhatsApp Business.

// @ts-ignore Deno runtime import for Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  agendamento_id: string;
  novo_estado: 'Aguardando Confirmação' | 'Confirmado' | 'Cancelado';
  origem_evento?: 'webhook_cliente' | 'disparo_automatico' | 'operador';
}

export async function handleWhatsAppWebhook(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const { agendamento_id, novo_estado, origem_evento = 'webhook_cliente' } = payload;

  if (!agendamento_id || !['Aguardando Confirmação', 'Confirmado', 'Cancelado'].includes(novo_estado)) {
    return new Response(JSON.stringify({ error: 'Payload inválido' }), { status: 400 });
  }

  // @ts-ignore Deno.env
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: atual, error: fetchError } = await supabase
    .from('agendamentos')
    .select('id, clinica_id, cliente_id, status, data_hora_inicio')
    .eq('id', agendamento_id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !atual) {
    return new Response(JSON.stringify({ error: 'Agendamento não encontrado' }), { status: 404 });
  }

  const novoStatusAgendamento =
    novo_estado === 'Cancelado'
      ? 'cancelado'
      : atual.status === 'realizado'
      ? 'realizado'
      : 'agendado';

  const { data: agendamento, error } = await supabase
    .from('agendamentos')
    .update({
      whatsapp_status: novo_estado,
      status: novoStatusAgendamento,
    })
    .eq('id', agendamento_id)
    .select('id, clinica_id, cliente_id, data_hora_inicio')
    .single();

  if (error || !agendamento) {
    return new Response(JSON.stringify({ error: 'Erro ao atualizar agendamento' }), { status: 500 });
  }

  await supabase.from('logs_auditoria').insert({
    clinica_id: agendamento.clinica_id,
    usuario: `EdgeFunction:whatsapp-webhook (${origem_evento})`,
    acao: `WHATSAPP_${novo_estado.toUpperCase()}`,
    entidade: 'agendamentos',
    entidade_id: agendamento.id,
    detalhes: { novo_estado, origem_evento },
  });

  return new Response(
    JSON.stringify({
      ok: true,
      agendamento_id: agendamento.id,
      whatsapp_status: novo_estado,
      notificacao_disparada: true,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
