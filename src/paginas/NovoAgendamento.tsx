import { CalendarPlus, Clock } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, mensagemDeErro } from '@/lib/api';
import { cn, formatarDuracao, formatarMoeda, hojeIso } from '@/lib/formato';
import { useDados } from '@/lib/useDados';
import type { Cliente, HorarioLivre, Local, PedidoEspera, Procedimento, Profissional } from '@/tipos';
import { AreaTexto, Botao, Campo, Carregando, Entrada, Modal, Selecao } from '@/ui/componentes';

interface Props {
  dataInicial: string;
  /** Quando o agendamento nasce de um pedido da lista de espera */
  pedido?: PedidoEspera | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}

/**
 * Formulário de agendamento: escolhe cliente, profissional, procedimento, local e data,
 * e mostra só os horários livres (o servidor confere expediente, intervalo e choques).
 * Se não houver horário, o cliente pode ir para a lista de espera.
 */
export function NovoAgendamento({ dataInicial, pedido, aoFechar, aoSalvar }: Props) {
  const [form, setForm] = useState({
    cliente_id: pedido?.cliente_id ?? '',
    profissional_id: pedido?.profissional_id ?? '',
    procedimento_id: pedido?.procedimento_id ?? '',
    local_id: pedido?.local_id ?? '',
    data: pedido?.data_desejada ?? dataInicial,
    observacoes: pedido?.observacoes ?? '',
  });
  const [horario, setHorario] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const alterar = (campo: keyof typeof form, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setHorario(null);
  };

  const { dados: cadastros } = useDados(async () => {
    const [clientes, profissionais, procedimentos, locais] = await Promise.all([
      api.get<Cliente[]>('/api/clientes?status=ativo'),
      api.get<Profissional[]>('/api/profissionais?status=ativo'),
      api.get<Procedimento[]>('/api/procedimentos?status=ativo'),
      api.get<Local[]>('/api/locais?status=ativo'),
    ]);
    return { clientes, profissionais, procedimentos, locais };
  });

  // Procedimentos que o profissional escolhido realiza
  const profissional = cadastros?.profissionais.find((p) => p.id === form.profissional_id);
  const procedimentosPossiveis = useMemo(() => {
    const todos = cadastros?.procedimentos ?? [];
    if (!profissional || profissional.procedimentos_vinculados.length === 0) return todos;
    return todos.filter((p) => profissional.procedimentos_vinculados.includes(p.id));
  }, [cadastros, profissional]);
  const procedimento = cadastros?.procedimentos.find((p) => p.id === form.procedimento_id);

  const pronto = form.profissional_id && form.procedimento_id && form.local_id && form.data;
  const { dados: disponibilidade, carregando: buscandoHorarios } = useDados(async () => {
    if (!pronto) return null;
    const consulta = new URLSearchParams({
      profissional_id: form.profissional_id,
      procedimento_id: form.procedimento_id,
      local_id: form.local_id,
      data: form.data,
    });
    const resposta = await api.get<{ slots: HorarioLivre[]; motivo?: string }>(`/api/disponibilidade?${consulta}`);
    // Hoje, não faz sentido oferecer horários que já passaram
    if (form.data === hojeIso()) {
      const agora = new Date();
      const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
      resposta.slots = resposta.slots.filter((s) => s.hora_inicio > horaAtual);
      if (resposta.slots.length === 0) resposta.motivo = 'Não há mais horários livres hoje.';
    }
    return resposta;
  }, [form.profissional_id, form.procedimento_id, form.local_id, form.data]);

  async function agendar(e: FormEvent) {
    e.preventDefault();
    if (!horario) return toast.error('Escolha um horário livre.');
    setSalvando(true);
    try {
      await api.post('/api/agendamentos', {
        cliente_id: form.cliente_id,
        profissional_id: form.profissional_id,
        procedimento_id: form.procedimento_id,
        local_id: form.local_id,
        data_hora_inicio: horario,
        observacoes: form.observacoes,
        origem: pedido ? 'lista_espera' : 'recepcao',
      });
      if (pedido) await api.patch(`/api/lista-espera/${pedido.id}/status`, { status: 'atendido' });
      toast.success('Agendamento criado. A confirmação foi enviada pelo WhatsApp.');
      aoSalvar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  async function entrarNaListaDeEspera() {
    if (!form.cliente_id || !pronto) return toast.error('Preencha cliente, profissional, procedimento, local e data.');
    setSalvando(true);
    try {
      await api.post('/api/lista-espera', {
        cliente_id: form.cliente_id,
        profissional_id: form.profissional_id,
        procedimento_id: form.procedimento_id,
        local_id: form.local_id,
        data_desejada: form.data,
        observacoes: form.observacoes,
      });
      toast.success('Cliente incluído na lista de espera.');
      aoSalvar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={pedido ? `Encaixar ${pedido.cliente_nome}` : 'Novo agendamento'}
      descricao="Só aparecem horários sem choque de profissional ou de sala."
      largura="max-w-2xl"
    >
      {!cadastros ? (
        <Carregando />
      ) : (
        <form onSubmit={agendar} className="grid gap-4">
          <Campo rotulo="Cliente">
            <Selecao required value={form.cliente_id} onChange={(e) => alterar('cliente_id', e.target.value)}>
              <option value="">Selecione…</option>
              {cadastros.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · {c.whatsapp}
                </option>
              ))}
            </Selecao>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Profissional">
              <Selecao
                required
                value={form.profissional_id}
                onChange={(e) => {
                  alterar('profissional_id', e.target.value);
                  alterar('procedimento_id', '');
                }}
              >
                <option value="">Selecione…</option>
                {cadastros.profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.especialidade})
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Procedimento">
              <Selecao required value={form.procedimento_id} onChange={(e) => alterar('procedimento_id', e.target.value)}>
                <option value="">Selecione…</option>
                {procedimentosPossiveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {formatarDuracao(p.duracao_min)}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Local">
              <Selecao required value={form.local_id} onChange={(e) => alterar('local_id', e.target.value)}>
                <option value="">Selecione…</option>
                {cadastros.locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Data">
              <Entrada type="date" required value={form.data} onChange={(e) => alterar('data', e.target.value)} />
            </Campo>
          </div>

          {procedimento && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {formatarMoeda(procedimento.valor)} · {formatarDuracao(procedimento.duracao_min)}
              {procedimento.orientacoes && <> · {procedimento.orientacoes}</>}
            </p>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Clock className="size-4" /> Horários livres
            </p>
            {!pronto ? (
              <p className="text-sm text-slate-500">Escolha profissional, procedimento, local e data.</p>
            ) : buscandoHorarios ? (
              <Carregando texto="Procurando horários…" />
            ) : disponibilidade?.slots.length ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {disponibilidade.slots.map((s) => (
                  <button
                    key={s.data_hora_inicio}
                    type="button"
                    onClick={() => setHorario(s.data_hora_inicio)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-sm tabular-nums transition-colors',
                      horario === s.data_hora_inicio
                        ? 'border-azul-700 bg-azul-700 text-white'
                        : 'border-slate-300 hover:border-azul-500 hover:bg-azul-50',
                    )}
                  >
                    {s.hora_inicio}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {disponibilidade?.motivo ?? 'Nenhum horário livre.'} Você pode colocar o cliente na lista de espera.
              </p>
            )}
          </div>

          <Campo rotulo="Observações">
            <AreaTexto value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} placeholder="Opcional" />
          </Campo>

          <div className="flex flex-wrap justify-end gap-2">
            {!pedido && (
              <Botao variante="secundario" onClick={entrarNaListaDeEspera} disabled={salvando}>
                Colocar na lista de espera
              </Botao>
            )}
            <Botao type="submit" carregando={salvando} disabled={!horario || !form.cliente_id}>
              <CalendarPlus className="size-4" /> Agendar
            </Botao>
          </div>
        </form>
      )}
    </Modal>
  );
}
