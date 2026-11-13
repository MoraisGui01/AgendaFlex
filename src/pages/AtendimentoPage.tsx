import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Stethoscope,
  User,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Skeleton } from '@/src/components/ui/skeleton';
import { apiFetch } from '@/src/lib/api';
import { formatBRL, formatDateTimeBR } from '@/src/lib/utils';
import type { Agendamento, AgendamentoStatus, Procedimento } from '@/src/types/clinic';

interface AtendimentoPageProps {
  selectedAgendamentoId: string | null;
  onSelectAgendamentoId: (id: string) => void;
  refreshSignal: number;
}

export function AtendimentoPage({
  selectedAgendamentoId,
  onSelectAgendamentoId,
  refreshSignal,
}: AtendimentoPageProps) {
  const [loading, setLoading] = React.useState(true);
  const [agendamentos, setAgendamentos] = React.useState<Agendamento[]>([]);
  const [historicoCliente, setHistoricoCliente] = React.useState<Agendamento[]>([]);
  const [procedimentosCatalogo, setProcedimentosCatalogo] = React.useState<Procedimento[]>([]);

  // Modal / Form dinâmico para "Adicionar Procedimento Extra"
  const [extraDialogOpen, setExtraDialogOpen] = React.useState(false);
  const [modoExtra, setModoExtra] = React.useState<'catalogo' | 'personalizado'>('catalogo');
  const [extraProcId, setExtraProcId] = React.useState('');
  const [extraNome, setExtraNome] = React.useState('');
  const [extraDuracao, setExtraDuracao] = React.useState('20');
  const [extraValor, setExtraValor] = React.useState('150');
  const [savingExtra, setSavingExtra] = React.useState(false);

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ags, procs] = await Promise.all([
        apiFetch<Agendamento[]>('/api/agendamentos'),
        apiFetch<Procedimento[]>('/api/procedimentos?status=ativo'),
      ]);
      setAgendamentos(ags);
      setProcedimentosCatalogo(procs);

      const targetId = selectedAgendamentoId || ags[0]?.id || null;
      if (targetId && !selectedAgendamentoId) {
        onSelectAgendamentoId(targetId);
      }

      const active = ags.find((a) => a.id === targetId);
      if (active) {
        const hist = await apiFetch<Agendamento[]>(`/api/agendamentos?cliente_id=${active.cliente_id}`);
        setHistoricoCliente(hist);
      } else {
        setHistoricoCliente([]);
      }
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedAgendamentoId, onSelectAgendamentoId]);

  React.useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace, refreshSignal]);

  const activeAgendamento = React.useMemo(
    () => agendamentos.find((a) => a.id === selectedAgendamentoId) ?? agendamentos[0] ?? null,
    [agendamentos, selectedAgendamentoId]
  );

  const openExtraDialog = () => {
    const first = procedimentosCatalogo[0];
    setModoExtra('catalogo');
    setExtraProcId(first?.id ?? '');
    setExtraNome(first?.nome ?? '');
    setExtraDuracao(String(first?.duracao_min ?? 20));
    setExtraValor(String(first?.valor ?? 150));
    setExtraDialogOpen(true);
  };

  const handleCatalogSelect = (procId: string) => {
    setExtraProcId(procId);
    const proc = procedimentosCatalogo.find((p) => p.id === procId);
    if (proc) {
      setExtraNome(proc.nome);
      setExtraDuracao(String(proc.duracao_min));
      setExtraValor(String(proc.valor));
    }
  };

  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAgendamento) return;
    setSavingExtra(true);
    try {
      await apiFetch(`/api/agendamentos/${activeAgendamento.id}/extras`, {
        method: 'POST',
        body: JSON.stringify({
          procedimento_id: modoExtra === 'catalogo' ? extraProcId : null,
          nome_procedimento: extraNome,
          duracao_min: Number(extraDuracao),
          valor: Number(extraValor),
        }),
      });
      toast.success('✅ Procedimento extra adicionado e total atualizado!');
      setExtraDialogOpen(false);
      await loadWorkspace();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setSavingExtra(false);
    }
  };

  const updateStatus = async (status: AgendamentoStatus) => {
    if (!activeAgendamento) return;
    try {
      await apiFetch(`/api/agendamentos/${activeAgendamento.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(
        status === 'realizado'
          ? '✅ Atendimento concluído como realizado!'
          : status === 'falta'
          ? 'Falta registrada no histórico do paciente.'
          : 'Atendimento cancelado.'
      );
      await loadWorkspace();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const renderStatusBadge = (status: AgendamentoStatus) => {
    if (status === 'realizado') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Realizado
        </span>
      );
    }
    if (status === 'falta' || status === 'cancelado') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
          <XCircle className="h-3.5 w-3.5" />
          {status === 'falta' ? 'Falta' : 'Cancelado'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1E3A8A]">
        <Clock className="h-3.5 w-3.5" />
        Agendado
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Área de Atendimento Clínico
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Histórico longitudinal do paciente em tempo real e registro de procedimentos extras durante a
            consulta.
          </p>
        </div>

        <div className="w-full sm:w-80">
          <Select
            value={activeAgendamento?.id ?? ''}
            onValueChange={(val) => onSelectAgendamentoId(val)}
          >
            <SelectTrigger aria-label="Selecionar atendimento ativo">
              <SelectValue placeholder="Selecione um agendamento" />
            </SelectTrigger>
            <SelectContent>
              {agendamentos.slice(0, 15).map((ag) => (
                <SelectItem key={ag.id} value={ag.id}>
                  {formatDateTimeBR(ag.data_hora_inicio)} — {ag.cliente_nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 lg:col-span-7 rounded-xl" />
          <Skeleton className="h-96 lg:col-span-5 rounded-xl" />
        </div>
      ) : !activeAgendamento ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-slate-900">Nenhum atendimento selecionado</p>
          <p className="mt-1 text-sm text-slate-500">
            Agende uma consulta na Agenda para iniciar o prontuário de atendimento.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Coluna Esquerda: Atendimento Atual e Procedimentos Extras */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              <CardHeader className="border-b border-slate-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <CardTitle className="text-lg">{activeAgendamento.cliente_nome}</CardTitle>
                      {renderStatusBadge(activeAgendamento.status)}
                    </div>
                    <CardDescription className="tabular-nums">
                      {formatDateTimeBR(activeAgendamento.data_hora_inicio)} –{' '}
                      {activeAgendamento.data_hora_fim.slice(11, 16)} · {activeAgendamento.local_nome}
                    </CardDescription>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-500">Profissional responsável</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {activeAgendamento.profissional_nome}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Totais em Tempo Real */}
                <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/70">
                  <div className="p-4 sm:px-6">
                    <p className="text-xs font-medium text-slate-500">Duração Total do Atendimento</p>
                    <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                      {activeAgendamento.duracao_total_min} min
                    </p>
                  </div>
                  <div className="p-4 sm:px-6">
                    <p className="text-xs font-medium text-slate-500">Valor Total Consolidado</p>
                    <p className="mt-1 font-mono text-2xl font-semibold text-[#1E3A8A] tabular-nums">
                      {formatBRL(activeAgendamento.valor_total)}
                    </p>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-6">
                  {/* Procedimento Principal */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-600">
                        Procedimento Principal Agendado
                      </h4>
                      <Button size="sm" variant="outline" onClick={openExtraDialog}>
                        <Plus className="h-4 w-4 text-[#1E3A8A]" />
                        <span>Adicionar Procedimento Extra</span>
                      </Button>
                    </div>
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-[#1E3A8A] shrink-0" />
                          {activeAgendamento.procedimento_nome}
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                          {formatBRL(activeAgendamento.procedimento_valor ?? 0)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 tabular-nums">
                        Duração prevista: {activeAgendamento.procedimento_duracao_min} min
                      </p>
                      {activeAgendamento.procedimento_orientacoes ? (
                        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
                          <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <span>{activeAgendamento.procedimento_orientacoes}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Procedimentos Extras Adicionados */}
                  <div className="space-y-2 border-t border-slate-100 pt-5">
                    <h4 className="text-xs font-semibold text-slate-600">
                      Procedimentos Extras Inseridos na Consulta ({activeAgendamento.extras?.length ?? 0})
                    </h4>
                    {!activeAgendamento.extras || activeAgendamento.extras.length === 0 ? (
                      <p className="py-3 text-xs text-slate-500">
                        Nenhum procedimento extra registrado durante este atendimento.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {activeAgendamento.extras.map((ext) => (
                          <div key={ext.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900">{ext.nome_procedimento}</p>
                              <p className="text-xs text-slate-500 tabular-nums">
                                +{ext.duracao_min} min · Adicionado por {ext.adicionado_por}
                              </p>
                            </div>
                            <span className="font-mono text-sm font-semibold tabular-nums text-[#1E3A8A] shrink-0">
                              +{formatBRL(ext.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ações de Fechamento */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-100">
                    <Button onClick={() => updateStatus('realizado')}>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Marcar como Realizado</span>
                    </Button>
                    <Button variant="outline" onClick={() => updateStatus('falta')}>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span>Registrar Falta</span>
                    </Button>
                    <Button variant="outline" onClick={() => updateStatus('cancelado')}>
                      <span>Cancelar Atendimento</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita: Histórico do Cliente em Tempo Real */}
          <div className="lg:col-span-5">
            <Card>
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-[#1E3A8A]" />
                  <span>Histórico do Cliente</span>
                </CardTitle>
                <CardDescription>
                  Todas as passagens de {activeAgendamento.cliente_nome} atualizadas em tempo real.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {historicoCliente.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">Sem registros anteriores.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {historicoCliente.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onSelectAgendamentoId(item.id)}
                        className={`py-3.5 first:pt-0 last:pb-0 cursor-pointer rounded-lg transition-colors px-2 -mx-2 hover:bg-slate-50 ${
                          item.id === activeAgendamento.id ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                            {formatDateTimeBR(item.data_hora_inicio)}
                          </span>
                          {renderStatusBadge(item.status)}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900">
                          {item.procedimento_nome}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.profissional_nome} ·{' '}
                          <span className="font-mono tabular-nums">{formatBRL(item.valor_total)}</span>
                        </p>
                        {item.extras && item.extras.length > 0 ? (
                          <p className="mt-1 text-xs font-medium text-[#1E3A8A]">
                            +{item.extras.length} procedimento(s) extra(s) realizado(s)
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Dialog Dinâmico: Adicionar Procedimento Extra */}
      <Dialog open={extraDialogOpen} onOpenChange={setExtraDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Procedimento Extra</DialogTitle>
            <DialogDescription>
              Insira um procedimento não planejado durante a consulta. O tempo e valor total serão
              recalculados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddExtra} className="space-y-4">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setModoExtra('catalogo')}
                className={`flex-1 min-h-[40px] rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  modoExtra === 'catalogo'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Selecionar do Catálogo
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoExtra('personalizado');
                  setExtraNome('');
                  setExtraDuracao('20');
                  setExtraValor('150');
                }}
                className={`flex-1 min-h-[40px] rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  modoExtra === 'personalizado'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Serviço Avulso
              </button>
            </div>

            {modoExtra === 'catalogo' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Procedimento do Catálogo</label>
                <Select value={extraProcId} onValueChange={handleCatalogSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedimentosCatalogo.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} ({p.duracao_min} min · {formatBRL(p.valor)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Descrição do Serviço Extra</label>
                <input
                  required
                  value={extraNome}
                  onChange={(e) => setExtraNome(e.target.value)}
                  placeholder="Ex: Cauterização química pontual"
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Tempo Adicional (min)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  required
                  value={extraDuracao}
                  onChange={(e) => setExtraDuracao(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Valor Adicional (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={extraValor}
                  onChange={(e) => setExtraValor(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExtraDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingExtra}>
                {savingExtra ? 'Atualizando...' : 'Confirmar Inclusão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
