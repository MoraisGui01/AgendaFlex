import { Ban, CheckCircle2, Clock, DollarSign, History, Plus, Stethoscope, UserX } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { api, mensagemDeErro } from '@/lib/api';
import { formatarData, formatarDuracao, formatarHora, formatarMoeda, hojeIso } from '@/lib/formato';
import { useDados } from '@/lib/useDados';
import { useNavegacao } from '@/navegacao';
import type { Agendamento, Procedimento, StatusAgendamento } from '@/tipos';
import { Botao, Campo, Cartao, Carregando, Entrada, Indicador, Modal, Selecao, TituloCartao, Vazio } from '@/ui/componentes';
import { SeloStatus } from '@/ui/status';

export function AtendimentoPagina() {
  const { parametros, ir } = useNavegacao();
  const selecionado = parametros.get('id') ?? '';
  const [adicionandoExtra, setAdicionandoExtra] = useState(false);

  // Atendimentos de hoje para o seletor (mais o selecionado, se for de outro dia)
  const lista = useDados(() => api.get<Agendamento[]>(`/api/agendamentos?data=${hojeIso()}`));
  const todos = useDados(() => (selecionado ? api.get<Agendamento[]>('/api/agendamentos') : Promise.resolve([])), [selecionado]);
  const atual = todos.dados?.find((a) => a.id === selecionado) ?? lista.dados?.find((a) => a.id === selecionado);

  const historico = useDados(
    () => (atual ? api.get<Agendamento[]>(`/api/agendamentos?cliente_id=${atual.cliente_id}`) : Promise.resolve([])),
    [atual?.cliente_id],
  );

  const recarregar = () => {
    lista.recarregar();
    todos.recarregar();
    historico.recarregar();
  };

  async function mudarStatus(status: StatusAgendamento, mensagem: string) {
    if (!atual) return;
    try {
      await api.patch(`/api/agendamentos/${atual.id}/status`, { status });
      toast.success(mensagem);
      recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  const opcoes = [...(lista.dados ?? [])];
  if (atual && !opcoes.some((a) => a.id === atual.id)) opcoes.unshift(atual);

  return (
    <div className="space-y-6">
      <Cartao className="flex flex-wrap items-end gap-4 p-5">
        <Campo rotulo="Atendimento" className="min-w-72 flex-1">
          <Selecao value={selecionado} onChange={(e) => ir('/atendimento', e.target.value ? { id: e.target.value } : undefined)}>
            <option value="">Selecione um atendimento de hoje…</option>
            {opcoes
              .filter((a) => a.status !== 'cancelado' || a.id === selecionado)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {formatarHora(a.data_hora_inicio)} · {a.cliente_nome} · {a.procedimento_nome}
                  {a.data_hora_inicio.slice(0, 10) !== hojeIso() ? ` (${formatarData(a.data_hora_inicio)})` : ''}
                </option>
              ))}
          </Selecao>
        </Campo>
      </Cartao>

      {!selecionado ? (
        <Cartao>
          <Vazio icone={<Stethoscope className="size-10" />} titulo="Nenhum atendimento selecionado" texto="Escolha um cliente acima ou clique em “Atender” na agenda." />
        </Cartao>
      ) : !atual ? (
        <Carregando />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Indicador titulo="Profissional" valor={<span className="text-lg">{atual.profissional_nome}</span>} detalhe={atual.local_nome} icone={<Stethoscope className="size-5" />} />
            <Indicador
              titulo="Duração total"
              valor={formatarDuracao(atual.duracao_total_min)}
              detalhe={`${formatarHora(atual.data_hora_inicio)} às ${formatarHora(atual.data_hora_fim)}`}
              icone={<Clock className="size-5" />}
            />
            <Indicador titulo="Valor total" valor={formatarMoeda(atual.valor_total)} detalhe="Procedimento + extras" icone={<DollarSign className="size-5" />} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Cartao className="xl:col-span-2">
              <TituloCartao
                titulo={atual.cliente_nome}
                descricao={`${formatarData(atual.data_hora_inicio)} · WhatsApp ${atual.cliente_whatsapp}`}
                acoes={<SeloStatus status={atual.status} />}
              />
              <div className="space-y-4 p-5 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{atual.procedimento_nome}</p>
                  <p className="text-slate-500">
                    {formatarDuracao(atual.procedimento_duracao_min)} · {formatarMoeda(atual.procedimento_valor)}
                  </p>
                  {atual.procedimento_orientacoes && <p className="mt-1 text-slate-600">{atual.procedimento_orientacoes}</p>}
                  {atual.observacoes && <p className="mt-1 text-slate-600">Observações: {atual.observacoes}</p>}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-slate-700">Procedimentos extras</p>
                    {atual.status !== 'cancelado' && (
                      <Botao tamanho="p" variante="secundario" onClick={() => setAdicionandoExtra(true)}>
                        <Plus className="size-3.5" /> Adicionar
                      </Botao>
                    )}
                  </div>
                  {atual.extras.length === 0 ? (
                    <p className="text-slate-500">Nenhum extra neste atendimento.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {atual.extras.map((x) => (
                        <li key={x.id} className="flex justify-between gap-4 px-3 py-2">
                          <span>
                            {x.nome_procedimento} <span className="text-slate-400">· {formatarDuracao(x.duracao_min)}</span>
                          </span>
                          <span className="tabular-nums">{formatarMoeda(x.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {atual.status === 'agendado' && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <Botao variante="sucesso" onClick={() => mudarStatus('realizado', 'Atendimento concluído.')}>
                      <CheckCircle2 className="size-4" /> Concluir atendimento
                    </Botao>
                    <Botao variante="secundario" onClick={() => mudarStatus('falta', 'Falta registrada.')}>
                      <UserX className="size-4" /> Registrar falta
                    </Botao>
                    <Botao variante="fantasma" onClick={() => mudarStatus('cancelado', 'Atendimento cancelado.')}>
                      <Ban className="size-4 text-red-600" /> Cancelar
                    </Botao>
                  </div>
                )}
                {atual.status !== 'agendado' && (
                  <div className="border-t border-slate-100 pt-4">
                    <Botao variante="secundario" onClick={() => mudarStatus('agendado', 'Atendimento reaberto.')}>
                      Reabrir atendimento
                    </Botao>
                  </div>
                )}
              </div>
            </Cartao>

            <Cartao>
              <TituloCartao titulo="Histórico do cliente" />
              {historico.dados && historico.dados.filter((h) => h.id !== atual.id).length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {historico.dados
                    .filter((h) => h.id !== atual.id)
                    .reverse()
                    .map((h) => (
                      <li key={h.id} className="flex items-start justify-between gap-2 px-5 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{h.procedimento_nome}</p>
                          <p className="text-slate-500">
                            {formatarData(h.data_hora_inicio)} · {h.profissional_nome}
                          </p>
                        </div>
                        <SeloStatus status={h.status} />
                      </li>
                    ))}
                </ul>
              ) : (
                <Vazio icone={<History className="size-8" />} titulo="Primeiro atendimento deste cliente" />
              )}
            </Cartao>
          </div>

          {adicionandoExtra && (
            <FormularioExtra
              agendamento={atual}
              aoFechar={() => setAdicionandoExtra(false)}
              aoSalvar={() => {
                setAdicionandoExtra(false);
                recarregar();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function FormularioExtra({ agendamento, aoFechar, aoSalvar }: { agendamento: Agendamento; aoFechar: () => void; aoSalvar: () => void }) {
  const { dados: catalogo } = useDados(() => api.get<Procedimento[]>('/api/procedimentos?status=ativo'));
  const [form, setForm] = useState({ procedimento_id: '', nome_procedimento: '', duracao_min: 15, valor: 0 });
  const [salvando, setSalvando] = useState(false);

  function escolherDoCatalogo(id: string) {
    const p = catalogo?.find((c) => c.id === id);
    setForm(p ? { procedimento_id: p.id, nome_procedimento: p.nome, duracao_min: p.duracao_min, valor: p.valor } : { ...form, procedimento_id: '' });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post(`/api/agendamentos/${agendamento.id}/extras`, { ...form, procedimento_id: form.procedimento_id || null });
      toast.success('Procedimento extra adicionado.');
      aoSalvar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Procedimento extra" descricao="O tempo é somado ao fim do atendimento, se não invadir o próximo horário.">
      <form onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Do catálogo (opcional)">
          <Selecao value={form.procedimento_id} onChange={(e) => escolherDoCatalogo(e.target.value)}>
            <option value="">Serviço avulso</option>
            {catalogo?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Descrição">
          <Entrada required value={form.nome_procedimento} onChange={(e) => setForm({ ...form, nome_procedimento: e.target.value })} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Tempo adicional (min)">
            <Entrada type="number" min={5} step={5} required value={form.duracao_min} onChange={(e) => setForm({ ...form, duracao_min: Number(e.target.value) })} />
          </Campo>
          <Campo rotulo="Valor adicional (R$)">
            <Entrada type="number" min={0} step="0.01" required value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
          </Campo>
        </div>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando}>
            Adicionar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
