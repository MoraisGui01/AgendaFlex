import { Bell, Check, MessageCircle, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, mensagemDeErro } from '@/lib/api';
import { formatarData, formatarDataHora, formatarHora, hojeIso } from '@/lib/formato';
import { useDados } from '@/lib/useDados';
import type { Agendamento, EstadoWhatsapp, MensagemWhatsapp } from '@/tipos';
import { Botao, Carregando, Modal, Vazio } from '@/ui/componentes';
import { SeloWhatsapp } from '@/ui/status';

/** Simula as respostas do cliente pelo WhatsApp (confirmar, cancelar ou reenviar lembrete). */
export function PainelWhatsapp({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const { dados, carregando, recarregar } = useDados(async () => {
    if (!aberto) return null;
    const [agendamentos, mensagens] = await Promise.all([
      api.get<Agendamento[]>('/api/agendamentos'),
      api.get<MensagemWhatsapp[]>('/api/whatsapp/mensagens'),
    ]);
    const hoje = hojeIso();
    const pendentes = agendamentos.filter(
      (a) => a.status === 'agendado' && a.whatsapp_status === 'Aguardando Confirmação' && a.data_hora_inicio.slice(0, 10) >= hoje,
    );
    return { pendentes, mensagens };
  }, [aberto]);

  async function responder(agendamento: Agendamento, estado: EstadoWhatsapp) {
    setEnviando(agendamento.id + estado);
    try {
      await api.post('/api/whatsapp/simular', { agendamento_id: agendamento.id, novo_estado: estado });
      toast.success(`${agendamento.cliente_nome}: ${estado}`);
      recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="WhatsApp · confirmações"
      descricao="Simulação das respostas dos clientes. Em produção, elas chegam pelo webhook do provedor."
      largura="max-w-3xl"
    >
      {carregando && !dados ? (
        <Carregando />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Aguardando resposta</h3>
            {dados?.pendentes.length ? (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {dados.pendentes.map((a) => (
                  <li key={a.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">{a.cliente_nome}</p>
                    <p className="text-slate-500">
                      {a.procedimento_nome} · {formatarData(a.data_hora_inicio)} às {formatarHora(a.data_hora_inicio)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Botao tamanho="p" variante="sucesso" carregando={enviando === a.id + 'Confirmado'} onClick={() => responder(a, 'Confirmado')}>
                        <Check className="size-3.5" /> Confirmar
                      </Botao>
                      <Botao tamanho="p" variante="perigo" carregando={enviando === a.id + 'Cancelado'} onClick={() => responder(a, 'Cancelado')}>
                        <X className="size-3.5" /> Cancelar
                      </Botao>
                      <Botao
                        tamanho="p"
                        variante="secundario"
                        carregando={enviando === a.id + 'Aguardando Confirmação'}
                        onClick={() => responder(a, 'Aguardando Confirmação')}
                      >
                        <Bell className="size-3.5" /> Lembrar
                      </Botao>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio icone={<Check className="size-8" />} titulo="Nenhuma confirmação pendente" />
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Últimas mensagens</h3>
            {dados?.mensagens.length ? (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {dados.mensagens.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-lg p-3 text-sm ${m.direcao === 'enviada' ? 'bg-emerald-50' : 'border border-slate-200 bg-white'}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {m.direcao === 'enviada' ? 'Clínica →' : '←'} {m.cliente_nome}
                      </span>
                      <SeloWhatsapp estado={m.estado} />
                    </div>
                    <p className="text-slate-800">{m.conteudo}</p>
                    <p className="mt-1 text-right text-[11px] text-slate-400">{formatarDataHora(m.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio icone={<MessageCircle className="size-8" />} titulo="Nenhuma mensagem ainda" />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
