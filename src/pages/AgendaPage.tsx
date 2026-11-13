import * as React from 'react';
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  Building2,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  MessageSquare,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Checkbox } from '@/src/components/ui/checkbox';
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
import { cn, formatBRL, formatDateBR } from '@/src/lib/utils';
import type {
  Agendamento,
  Cliente,
  ListaEsperaItem,
  LocalClinica,
  Procedimento,
  Profissional,
  SlotDisponivel,
  WhatsAppStatus,
} from '@/src/types/clinic';

interface AgendaPageProps {
  onSelectAtendimento: (agendamentoId: string) => void;
  refreshSignal: number;
}

export function AgendaPage({ onSelectAtendimento, refreshSignal }: AgendaPageProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [monthCursor, setMonthCursor] = React.useState<Date>(new Date());
  const [profFilter, setProfFilter] = React.useState<string>('todos');
  const [localFilter, setLocalFilter] = React.useState<string>('todos');

  const [loading, setLoading] = React.useState(true);
  const [agendamentos, setAgendamentos] = React.useState<Agendamento[]>([]);
  const [listaEspera, setListaEspera] = React.useState<ListaEsperaItem[]>([]);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [locais, setLocais] = React.useState<LocalClinica[]>([]);
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [procedimentos, setProcedimentos] = React.useState<Procedimento[]>([]);

  // Dialog Novo Agendamento
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formClienteId, setFormClienteId] = React.useState('');
  const [formProfId, setFormProfId] = React.useState('');
  const [formProcId, setFormProcId] = React.useState('');
  const [formLocalId, setFormLocalId] = React.useState('');
  const [formDate, setFormDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [formObs, setFormObs] = React.useState('');
  const [selectedSlot, setSelectedSlot] = React.useState<SlotDisponivel | null>(null);
  const [entrarListaEspera, setEntrarListaEspera] = React.useState(false);

  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [slots, setSlots] = React.useState<SlotDisponivel[]>([]);
  const [slotsMotivo, setSlotsMotivo] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const dateIso = format(selectedDate, 'yyyy-MM-dd');

  const loadBaseAndAgenda = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ags, espera, profs, locs, clis, procs] = await Promise.all([
        apiFetch<Agendamento[]>(`/api/agendamentos?data=${dateIso}`),
        apiFetch<ListaEsperaItem[]>('/api/lista-espera'),
        apiFetch<Profissional[]>('/api/profissionais?status=ativo'),
        apiFetch<LocalClinica[]>('/api/locais?status=ativo'),
        apiFetch<Cliente[]>('/api/clientes?status=ativo'),
        apiFetch<Procedimento[]>('/api/procedimentos?status=ativo'),
      ]);
      setAgendamentos(ags);
      setListaEspera(espera);
      setProfissionais(profs);
      setLocais(locs);
      setClientes(clis);
      setProcedimentos(procs);
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [dateIso]);

  React.useEffect(() => {
    loadBaseAndAgenda();
  }, [loadBaseAndAgenda, refreshSignal]);

  // Consulta automática de horários livres ao selecionar profissional, procedimento, local e data
  React.useEffect(() => {
    if (!dialogOpen || !formProfId || !formProcId || !formLocalId || !formDate) {
      setSlots([]);
      setSlotsMotivo(null);
      return;
    }

    let cancelled = false;
    const fetchSlots = async () => {
      setSlotsLoading(true);
      setSelectedSlot(null);
      setSlotsMotivo(null);
      try {
        const q = new URLSearchParams({
          profissional_id: formProfId,
          procedimento_id: formProcId,
          local_id: formLocalId,
          data: formDate,
        });
        const res = await apiFetch<{ slots: SlotDisponivel[]; motivo?: string }>(
          `/api/disponibilidade?${q.toString()}`
        );
        if (!cancelled) {
          setSlots(res.slots);
          setSlotsMotivo(res.motivo ?? null);
          if (res.slots.length === 0) {
            setEntrarListaEspera(true);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(`❌ Erro ao validar disponibilidade: ${err.message}`);
          setSlots([]);
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    };

    fetchSlots();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, formProfId, formProcId, formLocalId, formDate]);

  const openNewDialog = () => {
    setFormDate(dateIso);
    setFormClienteId(clientes[0]?.id ?? '');
    const defaultProf = profissionais[0];
    setFormProfId(defaultProf?.id ?? '');
    const linkedProc =
      defaultProf?.procedimentos_vinculados?.[0] || procedimentos[0]?.id || '';
    setFormProcId(linkedProc);
    setFormLocalId(locais[0]?.id ?? '');
    setFormObs('');
    setSelectedSlot(null);
    setEntrarListaEspera(false);
    setDialogOpen(true);
  };

  const handleProfChangeInForm = (newProfId: string) => {
    setFormProfId(newProfId);
    const prof = profissionais.find((p) => p.id === newProfId);
    if (prof && prof.procedimentos_vinculados.length > 0) {
      if (!prof.procedimentos_vinculados.includes(formProcId)) {
        setFormProcId(prof.procedimentos_vinculados[0]);
      }
    }
  };

  const handleSubmitAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClienteId || !formProfId || !formProcId || !formLocalId) {
      toast.error('❌ Preencha cliente, profissional, procedimento e local.');
      return;
    }

    setSubmitting(true);
    try {
      if (entrarListaEspera && !selectedSlot) {
        await apiFetch('/api/lista-espera', {
          method: 'POST',
          body: JSON.stringify({
            cliente_id: formClienteId,
            profissional_id: formProfId,
            procedimento_id: formProcId,
            local_id: formLocalId,
            data_desejada: formDate,
            observacoes: formObs || 'Solicitação via agenda sem horário livre.',
          }),
        });
        toast.success('✅ Cliente incluído na lista de espera com sucesso!');
        setDialogOpen(false);
        loadBaseAndAgenda();
        return;
      }

      if (!selectedSlot) {
        toast.error('❌ Erro ao validar disponibilidade. Verifique o horário selecionado.');
        setSubmitting(false);
        return;
      }

      await apiFetch('/api/agendamentos', {
        method: 'POST',
        body: JSON.stringify({
          cliente_id: formClienteId,
          profissional_id: formProfId,
          local_id: formLocalId,
          procedimento_id: formProcId,
          data_hora_inicio: selectedSlot.data_hora_inicio,
          origem: 'recepcao',
          observacoes: formObs,
        }),
      });

      if (entrarListaEspera) {
        await apiFetch('/api/lista-espera', {
          method: 'POST',
          body: JSON.stringify({
            cliente_id: formClienteId,
            profissional_id: formProfId,
            procedimento_id: formProcId,
            local_id: formLocalId,
            data_desejada: formDate,
            observacoes: 'Aguardando eventual encaixe mais cedo.',
          }),
        });
      }

      toast.success('✅ Agendamento confirmado com sucesso!');
      setDialogOpen(false);
      if (formDate !== dateIso) {
        const [y, m, d] = formDate.split('-').map(Number);
        setSelectedDate(new Date(y, m - 1, d));
      } else {
        loadBaseAndAgenda();
      }
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppAction = async (agId: string, novoEstado: WhatsAppStatus) => {
    try {
      await apiFetch('/api/whatsapp/simular', {
        method: 'POST',
        body: JSON.stringify({ agendamento_id: agId, novo_estado: novoEstado }),
      });
      if (novoEstado === 'Confirmado') {
        toast.success('✅ Agendamento confirmado com sucesso!');
      } else if (novoEstado === 'Cancelado') {
        toast.info('Agendamento cancelado e horário liberado na agenda.');
      }
      loadBaseAndAgenda();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const filteredAgendamentos = agendamentos.filter((ag) => {
    const matchProf = profFilter === 'todos' || ag.profissional_id === profFilter;
    const matchLocal = localFilter === 'todos' || ag.local_id === localFilter;
    return matchProf && matchLocal;
  });

  // Mini calendário mensal
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
  });

  const selectedProfObj = profissionais.find((p) => p.id === formProfId);
  const formProcedimentosDisponiveis = React.useMemo(() => {
    if (!selectedProfObj || selectedProfObj.procedimentos_vinculados.length === 0) {
      return procedimentos;
    }
    const vinculados = procedimentos.filter((p) =>
      selectedProfObj.procedimentos_vinculados.includes(p.id)
    );
    return vinculados.length > 0 ? vinculados : procedimentos;
  }, [selectedProfObj, procedimentos]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Agenda & Controle de Conflitos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cruzamento automático de horários por profissional e consultório físico para impedir reservas
            simultâneas.
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <CalendarPlus className="h-4 w-4" />
          <span>Novo Agendamento</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Coluna Esquerda: Calendário + Lista de Espera */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="capitalize text-sm">
                  {format(monthCursor, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Mês anterior"
                    onClick={() => setMonthCursor((d) => subDays(startOfMonth(d), 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Próximo mês"
                    onClick={() => setMonthCursor((d) => addDays(endOfMonth(d), 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, idx) => (
                  <div key={idx} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const selected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const inMonth = isSameMonth(day, monthCursor);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        'h-10 w-full rounded-lg text-xs font-medium tabular-nums transition-colors cursor-pointer',
                        !inMonth && 'text-slate-300',
                        inMonth && !selected && 'text-slate-700 hover:bg-slate-100',
                        isToday && !selected && 'border border-[#1E3A8A]/40 text-[#1E3A8A] font-semibold',
                        selected && 'bg-[#1E3A8A] text-white font-semibold'
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Dia ativo: <strong className="text-slate-800">{formatDateBR(dateIso)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setSelectedDate(now);
                    setMonthCursor(now);
                  }}
                  className="text-xs font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
                >
                  Ir para hoje
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListChecks className="h-4 w-4 text-[#1E3A8A]" />
                <span>Lista de Espera ({listaEspera.length})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Pacientes aguardando desistência ou encaixe na grade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {listaEspera.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum paciente na lista de espera.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {listaEspera.slice(0, 5).map((item) => (
                    <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {item.cliente_nome}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-slate-500">
                          {formatDateBR(item.data_desejada)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate">
                        {item.procedimento_nome} · {item.profissional_nome}
                      </p>
                      {item.observacoes ? (
                        <p className="text-[11px] text-slate-400 truncate">{item.observacoes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Grade Diária Cruzada */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate((d) => subDays(d, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold text-slate-900 capitalize min-w-[190px] text-center">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate((d) => addDays(d, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="w-full sm:w-48">
                  <Select value={profFilter} onValueChange={setProfFilter}>
                    <SelectTrigger aria-label="Filtrar por profissional">
                      <SelectValue placeholder="Profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos profissionais</SelectItem>
                      {profissionais.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-48">
                  <Select value={localFilter} onValueChange={setLocalFilter}>
                    <SelectTrigger aria-label="Filtrar por local">
                      <SelectValue placeholder="Local" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os locais</SelectItem>
                      {locais.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          {loading ? (
            <Card className="divide-y divide-slate-100">
              <div className="p-5"><Skeleton className="h-14 w-full" /></div>
              <div className="p-5"><Skeleton className="h-14 w-full" /></div>
              <div className="p-5"><Skeleton className="h-14 w-full" /></div>
            </Card>
          ) : filteredAgendamentos.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Nenhum agendamento para os filtros selecionados
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Todos os consultórios e profissionais estão disponíveis para marcação nesta data.
              </p>
              <div className="mt-4">
                <Button onClick={openNewDialog}>
                  <CalendarPlus className="h-4 w-4" />
                  <span>Agendar neste dia</span>
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800 tabular-nums">
                  {filteredAgendamentos.length} atendimento(s) na grade
                </span>
                <span>Validação ativa contra choque de profissional e local</span>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredAgendamentos.map((ag) => (
                  <div
                    key={ag.id}
                    className="flex flex-col gap-4 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="rounded-lg bg-slate-100/90 px-3 py-2 text-center shrink-0 min-w-[74px]">
                        <p className="font-mono text-sm font-semibold text-[#1E3A8A] tabular-nums">
                          {ag.data_hora_inicio.slice(11, 16)}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {ag.data_hora_fim.slice(11, 16)}
                        </p>
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="text-sm font-semibold text-slate-900">{ag.cliente_nome}</h3>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              ag.status === 'realizado'
                                ? 'text-green-700'
                                : ag.status === 'falta' || ag.status === 'cancelado'
                                ? 'text-red-600'
                                : 'text-[#1E3A8A]'
                            }`}
                          >
                            {ag.status === 'realizado'
                              ? 'Realizado'
                              : ag.status === 'falta'
                              ? 'Falta'
                              : ag.status === 'cancelado'
                              ? 'Cancelado'
                              : 'Agendado'}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              ag.whatsapp_status === 'Confirmado'
                                ? 'text-emerald-700'
                                : ag.whatsapp_status === 'Cancelado'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          >
                            <MessageSquare className="h-3 w-3 shrink-0" />
                            {ag.whatsapp_status}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-slate-700">
                          {ag.procedimento_nome}{' '}
                          <span className="text-slate-400">·</span>{' '}
                          <span className="font-mono tabular-nums text-slate-600">
                            {ag.duracao_total_min} min
                          </span>{' '}
                          <span className="text-slate-400">·</span>{' '}
                          <span className="font-mono tabular-nums text-slate-800">
                            {formatBRL(ag.valor_total)}
                          </span>
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                            {ag.profissional_nome}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {ag.local_nome}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {ag.status === 'agendado' && ag.whatsapp_status !== 'Confirmado' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleWhatsAppAction(ag.id, 'Confirmado')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <span>Confirmar WhatsApp</span>
                        </Button>
                      ) : null}
                      {ag.status === 'agendado' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleWhatsAppAction(ag.id, 'Cancelado')}
                        >
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                          <span>Cancelar</span>
                        </Button>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={() => onSelectAtendimento(ag.id)}>
                        <Activity className="h-3.5 w-3.5 text-[#1E3A8A]" />
                        <span>Atendimento</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de Novo Agendamento com Consulta de Horários Livres */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Agendamento Inteligente</DialogTitle>
            <DialogDescription>
              Ao selecionar profissional, local e procedimento, apenas horários livres de conflito serão
              exibidos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitAgendamento} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Cliente / Paciente</label>
              <Select value={formClienteId} onValueChange={setFormClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} ({c.whatsapp})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Profissional</label>
                <Select value={formProfId} onValueChange={handleProfChangeInForm}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {profissionais.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Procedimento</label>
                <Select value={formProcId} onValueChange={setFormProcId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {formProcedimentosDisponiveis.map((proc) => (
                      <SelectItem key={proc.id} value={proc.id}>
                        {proc.nome} ({proc.duracao_min} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Local / Consultório</label>
                <Select value={formLocalId} onValueChange={setFormLocalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a sala" />
                  </SelectTrigger>
                  <SelectContent>
                    {locais.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Data Desejada</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
            </div>

            {/* Grade de Horários Livres */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#1E3A8A]" />
                  <span>Horários Livres (Sem Conflitos)</span>
                </label>
                <span className="text-xs text-slate-500 tabular-nums">
                  {slots.length} opções encontradas
                </span>
              </div>

              {slotsLoading ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                  <p className="font-semibold">
                    {slotsMotivo || 'Nenhum horário livre disponível para esta combinação.'}
                  </p>
                  <p className="mt-1 text-amber-800">
                    Marque a opção abaixo para registrar o paciente na lista de espera.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-0.5">
                  {slots.map((slot) => {
                    const active = selectedSlot?.data_hora_inicio === slot.data_hora_inicio;
                    return (
                      <button
                        key={slot.data_hora_inicio}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          'min-h-[44px] rounded-lg border text-xs font-mono font-medium tabular-nums transition-colors cursor-pointer',
                          active
                            ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-[#1E3A8A]/50 hover:bg-blue-50/40'
                        )}
                      >
                        {slot.hora_inicio}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Observações Clínicas / Recepção</label>
              <input
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                placeholder="Opcional: observações de triagem ou preferência de encaixe"
                className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 cursor-pointer">
              <Checkbox
                checked={entrarListaEspera}
                onCheckedChange={(checked) => setEntrarListaEspera(Boolean(checked))}
              />
              <span className="text-xs sm:text-sm font-medium">Desejo entrar na lista de espera</span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? 'Validando...'
                  : entrarListaEspera && !selectedSlot
                  ? 'Entrar na Lista de Espera'
                  : 'Confirmar Agendamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
