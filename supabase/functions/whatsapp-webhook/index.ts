// Supabase Edge Function (Deno): recebe as respostas do cliente pelo WhatsApp.
// O provedor (ex.: WhatsApp Business API) chama este endpoint quando o cliente responde
// "1" (confirmar) ou "2" (cancelar). A função atualiza o agendamento e registra a mensagem
// e a auditoria, como a rota /api/whatsapp/simular faz no servidor de desenvolvimento.

// @ts-ignore: import resolvido pelo Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: { env: { get(nome: string): string | undefined }; serve(fn: (req: Request) => Promise<Response>): void };

type Estado = 'Aguardando Confirmação' | 'Confirmado' | 'Cancelado';

interface Mensagem {
  agendamento_id: string;
  resposta: string;
}

const RESPOSTAS: Record<string, Estado> = { '1': 'Confirmado', '2': 'Cancelado' };

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  // O provedor assina as chamadas com um segredo compartilhado
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WHATSAPP_WEBHOOK_SECRET')) {
    return json({ error: 'Assinatura inválida.' }, 401);
  }

  const { agendamento_id, resposta } = (await req.json()) as Mensagem;
  const estado = RESPOSTAS[resposta?.trim()];
  if (!agendamento_id || !estado) return json({ error: 'Resposta não reconhecida.' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: ag, error } = await supabase
    .from('agendamentos')
    .select('id, clinica_id, status, clientes(whatsapp, nome)')
    .eq('id', agendamento_id)
    .is('deleted_at', null)
    .single();
  if (error || !ag) return json({ error: 'Agendamento não encontrado.' }, 404);

  const novoStatus = estado === 'Cancelado' ? 'cancelado' : ag.status;
  const { error: erroAtualizacao } = await supabase
    .from('agendamentos')
    .update({ whatsapp_status: estado, status: novoStatus })
    .eq('id', agendamento_id);
  // A restrição EXCLUDE do banco impede reativar um horário que já foi ocupado
  if (erroAtualizacao) return json({ error: 'Não foi possível atualizar o agendamento.' }, 409);

  const cliente = ag.clientes as unknown as { whatsapp: string; nome: string };
  await supabase.from('whatsapp_mensagens').insert({
    agendamento_id,
    telefone: cliente.whatsapp,
    estado,
    conteudo: estado === 'Confirmado' ? 'Presença confirmada pelo cliente.' : 'Cancelado pelo cliente. Horário liberado.',
    direcao: 'recebida',
  });
  await supabase.from('logs_auditoria').insert({
    clinica_id: ag.clinica_id,
    usuario: 'WhatsApp (webhook)',
    acao: `WHATSAPP_${estado.toUpperCase()}`,
    entidade: 'agendamentos',
    entidade_id: agendamento_id,
    detalhes: { cliente: cliente.nome },
  });

  return json({ ok: true, agendamento_id, whatsapp_status: estado, status: novoStatus });
});
