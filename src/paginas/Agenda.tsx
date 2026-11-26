import { CalendarPlus, ChevronLeft, ChevronRight, MessageCircle, Stethoscope, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, mensagemDeErro } from '@/lib/api';
import { dataPorExtenso, formatarData, formatarHora, formatarMoeda, hojeIso, somarDias } from '@/lib/formato';
import { useDados } from '@/lib/useDados';
import { useNavegacao } from '@/navegacao';
import type { Agendamento, Local, PedidoEspera, Profissional } from '@/tipos';
import { Botao, Cartao, Carregando, Entrada, Erro, Selecao, TituloCartao, Vazio } from '@/ui/componentes';
import { ORIGENS, SeloStatus, SeloWhatsapp } from '@/ui/status';
import { NovoAgendamento } from './NovoAgendamento';

export function AgendaPagina() {
  const { ir } = useNavegacao();
  const [data, setData] = useState(hojeIso());
  const [profissional, setProfissional] = useState('todos');
  const [local, setLocal] = useState('todos');
  const [formulario, setFormulario] = useState<{ pedido: PedidoEspera | null } | null>(null);

  const { dados: filtros } = useDados(async () => {
    const [profissionais, locais] = await Promise.all([
      api.get<Profissional[]>('/api/profissionais?status=ativo'),
      api.get<Local[]>('/api/locais?status=ativo'),
    ]);
    return { profissionais, locais };
  });

  const agenda = useDados(
    () =>
      api.get<Agendamento[]>(`/api/agendamentos?${new URLSearchParams({ data, profissional_id: profissional, local_id: local })}`),
    [data, profissional, local],
  );
  const espera = useDados(() => api.get<PedidoEspera[]>('/api/lista-espera?status=aguardando'));

  const recarregarTudo = () => {
    agenda.recarregar();
    espera.recarregar();
  };

  async function cancelar(a: Agendamento) {
    if (!window.confirm(`Cancelar o horário de ${a.cliente_nome} às ${formatarHora(a.data_hora_inicio)}?`)) return;
    try {
      await api.patch(`/api/agendamentos/${a.id}/status`, { status: 'cancelado' });
      toast.success('Agendamento cancelado e horário liberado.');
      agenda.recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  async function confirmarWhatsapp(a: Agendamento) {
    try {
      await api.post('/api/whatsapp/simular', { agendamento_id: a.id, novo_estado: 'Confirmado' });
      toast.success(`${a.cliente_nome} confirmou pelo WhatsApp.`);
      agenda.recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  async function descartarPedido(p: PedidoEspera) {
    try {
      await api.patch(`/api/lista-espera/${p.id}/status`, { status: 'cancelado' });
      espera.recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <Cartao>
        <TituloCartao
          titulo={dataPorExtenso(data)}
          descricao={`${agenda.dados?.filter((a) => a.status !== 'cancelado').length ?? 0} atendimentos`}
          acoes={
            <Botao onClick={() => setFormulario({ pedido: null })}>
              <CalendarPlus className="size-4" /> Novo agendamento
            </Botao>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <Botao variante="secundario" tamanho="p" onClick={() => setData(somarDias(data, -1))} aria-label="Dia anterior">
            <ChevronLeft className="size-4" />
          </Botao>
          <Entrada type="date" className="h-8 w-40" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
          <Botao variante="secundario" tamanho="p" onClick={() => setData(somarDias(data, 1))} aria-label="Próximo dia">
            <ChevronRight className="size-4" />
          </Botao>
          <Botao variante="fantasma" tamanho="p" onClick={() => setData(hojeIso())}>
            Hoje
          </Botao>
          <div className="ml-auto flex flex-wrap gap-2">
            <Selecao className="h-8 w-52" value={profissional} onChange={(e) => setProfissional(e.target.value)} aria-label="Profissional">
              <option value="todos">Todos os profissionais</option>
              {filtros?.profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Selecao>
            <Selecao className="h-8 w-52" value={local} onChange={(e) => setLocal(e.target.value)} aria-label="Local">
              <option value="todos">Todos os locais</option>
              {filtros?.locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Selecao>
          </div>
        </div>

        {agenda.erro && <Erro mensagem={agenda.erro} aoTentar={agenda.recarregar} />}
        {agenda.carregando && !agenda.dados ? (
          <Carregando />
        ) : agenda.dados?.length === 0 ? (
          <Vazio titulo="Agenda livre neste dia" texto="Use “Novo agendamento” para marcar um horário." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {agenda.dados?.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-start gap-4 px-5 py-4 text-sm ${a.status === 'cancelado' ? 'opacity-60' : ''}`}>
                <div className="w-20 shrink-0 tabular-nums">
                  <p className="text-base font-semibold text-slate-900">{formatarHora(a.data_hora_inicio)}</p>
                  <p className="text-slate-400">até {formatarHora(a.data_hora_fim)}</p>
                </div>
                <div className="min-w-56 flex-1">
                  <p className="font-medium text-slate-900">{a.cliente_nome}</p>
                  <p className="text-slate-600">{a.procedimento_nome}</p>
                  <p className="text-slate-500">
                    {a.profissional_nome} · {a.local_nome}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatarMoeda(a.valor_total)} · origem: {ORIGENS[a.origem]}
                    {a.observacoes && ` · ${a.observacoes}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <SeloWhatsapp estado={a.whatsapp_status} />
                    <SeloStatus status={a.status} />
                  </div>
                  {a.status === 'agendado' && (
                    <div className="flex flex-wrap justify-end gap-1">
                      {a.whatsapp_status !== 'Confirmado' && (
                        <Botao tamanho="p" variante="fantasma" onClick={() => confirmarWhatsapp(a)}>
                          <MessageCircle className="size-3.5 text-emerald-600" /> Confirmar
                        </Botao>
                      )}
                      <Botao tamanho="p" variante="fantasma" onClick={() => cancelar(a)}>
                        <X className="size-3.5 text-red-600" /> Cancelar
                      </Botao>
                      <Botao tamanho="p" variante="secundario" onClick={() => ir('/atendimento', { id: a.id })}>
                        <Stethoscope className="size-3.5" /> Atender
                      </Botao>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao className="h-fit">
        <TituloCartao titulo="Lista de espera" descricao="Encaixe quando surgir um horário" />
        {espera.dados?.length ? (
          <ul className="divide-y divide-slate-100">
            {espera.dados.map((p) => (
              <li key={p.id} className="px-5 py-3 text-sm">
                <p className="font-medium text-slate-900">{p.cliente_nome}</p>
                <p className="text-slate-500">
                  {p.procedimento_nome} · {p.profissional_nome}
                </p>
                <p className="text-xs text-slate-400">Deseja {formatarData(p.data_desejada)}</p>
                <div className="mt-2 flex gap-2">
                  <Botao tamanho="p" onClick={() => setFormulario({ pedido: p })}>
                    Encaixar
                  </Botao>
                  <Botao tamanho="p" variante="fantasma" onClick={() => descartarPedido(p)}>
                    Remover
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Vazio titulo="Lista vazia" />
        )}
      </Cartao>

      {formulario && (
        <NovoAgendamento
          dataInicial={data}
          pedido={formulario.pedido}
          aoFechar={() => setFormulario(null)}
          aoSalvar={() => {
            setFormulario(null);
            recarregarTudo();
          }}
        />
      )}
    </div>
  );
}
