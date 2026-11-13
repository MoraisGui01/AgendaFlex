import * as React from 'react';
import { CheckCircle2, Clock, MessageSquare, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Skeleton } from '@/src/components/ui/skeleton';
import { apiFetch } from '@/src/lib/api';
import { formatDateTimeBR } from '@/src/lib/utils';
import type { Agendamento, WhatsAppMensagem, WhatsAppStatus } from '@/src/types/clinic';

interface WhatsAppPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated?: () => void;
}

export function WhatsAppPanelDialog({ open, onOpenChange, onMutated }: WhatsAppPanelDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [agendamentos, setAgendamentos] = React.useState<Agendamento[]>([]);
  const [mensagens, setMensagens] = React.useState<WhatsAppMensagem[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ags, msgs] = await Promise.all([
        apiFetch<Agendamento[]>('/api/agendamentos'),
        apiFetch<WhatsAppMensagem[]>('/api/whatsapp/mensagens'),
      ]);
      setAgendamentos(ags.filter((a) => a.status === 'agendado').slice(0, 6));
      setMensagens(msgs);
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const simularWebhook = async (agendamentoId: string, novoEstado: WhatsAppStatus) => {
    setBusyId(agendamentoId);
    try {
      await apiFetch('/api/whatsapp/simular', {
        method: 'POST',
        body: JSON.stringify({ agendamento_id: agendamentoId, novo_estado: novoEstado }),
      });
      if (novoEstado === 'Confirmado') {
        toast.success('✅ Agendamento confirmado com sucesso!');
      } else if (novoEstado === 'Cancelado') {
        toast.info('Agendamento cancelado via WhatsApp e horário liberado.');
      } else {
        toast.success('✅ Lembrete reenviado para o WhatsApp do cliente.');
      }
      await loadData();
      onMutated?.();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#1E3A8A]" />
            <span>Integração WhatsApp · Simulação Edge Function</span>
          </DialogTitle>
          <DialogDescription>
            Dispare ou simule respostas de confirmação dos pacientes via webhook Supabase Edge Function
            (whatsapp-webhook).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-semibold text-slate-600 mb-2.5">
                Agendamentos ativos para disparo / simulação de resposta
              </h4>
              {agendamentos.length === 0 ? (
                <p className="text-sm text-slate-500 py-3">Nenhum agendamento pendente no momento.</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {agendamentos.map((ag) => (
                    <div
                      key={ag.id}
                      className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{ag.cliente_nome}</p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {formatDateTimeBR(ag.data_hora_inicio)} · {ag.procedimento_nome} ·{' '}
                          <span className="font-medium text-slate-700">{ag.whatsapp_status}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === ag.id}
                          onClick={() => simularWebhook(ag.id, 'Aguardando Confirmação')}
                        >
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          <span>Lembrar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === ag.id}
                          onClick={() => simularWebhook(ag.id, 'Confirmado')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <span>Confirmar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === ag.id}
                          onClick={() => simularWebhook(ag.id, 'Cancelado')}
                        >
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                          <span>Cancelar</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-600 mb-2.5">
                Notificações automáticas recentes
              </h4>
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
                {mensagens.map((msg) => (
                  <div key={msg.id} className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2 text-slate-500">
                      <span className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Send className="h-3 w-3 text-[#1E3A8A]" />
                        {msg.cliente_nome} ({msg.telefone})
                      </span>
                      <span className="tabular-nums">{formatDateTimeBR(msg.created_at)}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{msg.conteudo}</p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Estado: {msg.estado} · Direção: {msg.direcao === 'enviada' ? 'Saída automática' : 'Retorno webhook'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
