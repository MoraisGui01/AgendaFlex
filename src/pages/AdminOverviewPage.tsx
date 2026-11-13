import * as React from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AppRoute } from '@/src/components/layout/AppShell';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { apiFetch } from '@/src/lib/api';
import { formatBRL, formatDateBR, getTodayLocal } from '@/src/lib/utils';
import type { Agendamento, ListaEsperaItem, RelatorioResponse } from '@/src/types/clinic';

interface AdminOverviewPageProps {
  onNavigate: (route: AppRoute) => void;
  onSelectAtendimento: (agendamentoId: string) => void;
  refreshSignal: number;
}

export function AdminOverviewPage({
  onNavigate,
  onSelectAtendimento,
  refreshSignal,
}: AdminOverviewPageProps) {
  const [loading, setLoading] = React.useState(true);
  const [hojeAgendamentos, setHojeAgendamentos] = React.useState<Agendamento[]>([]);
  const [listaEspera, setListaEspera] = React.useState<ListaEsperaItem[]>([]);
  const [relatorio, setRelatorio] = React.useState<RelatorioResponse | null>(null);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const today = getTodayLocal();

  const loadOverview = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ags, espera, rel] = await Promise.all([
        apiFetch<Agendamento[]>(`/api/agendamentos?data=${today}`),
        apiFetch<ListaEsperaItem[]>('/api/lista-espera'),
        apiFetch<RelatorioResponse>('/api/relatorios'),
      ]);
      setHojeAgendamentos(ags);
      setListaEspera(espera.filter((e) => e.status === 'aguardando'));
      setRelatorio(rel);
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [today]);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshSignal]);

  const confirmarRapido = async (agendamentoId: string) => {
    setConfirmingId(agendamentoId);
    try {
      await apiFetch('/api/whatsapp/simular', {
        method: 'POST',
        body: JSON.stringify({ agendamento_id: agendamentoId, novo_estado: 'Confirmado' }),
      });
      toast.success('✅ Agendamento confirmado com sucesso!');
      await loadOverview();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setConfirmingId(null);
    }
  };

  const confirmadosHoje = hojeAgendamentos.filter(
    (a) => a.whatsapp_status === 'Confirmado' && a.status !== 'cancelado'
  ).length;
  const pendentesConfirmacao = hojeAgendamentos.filter(
    (a) => a.whatsapp_status === 'Aguardando Confirmação' && a.status === 'agendado'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Painel Operacional da Clínica
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Visão consolidada da grade de hoje ({formatDateBR(today)}), confirmações pendentes e lista de
            espera.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={() => onNavigate('/atendimento')}>
            <Activity className="h-4 w-4 text-slate-600" />
            <span>Atendimento</span>
          </Button>
          <Button onClick={() => onNavigate('/agenda')}>
            <CalendarDays className="h-4 w-4" />
            <span>Gerenciar Agenda</span>
          </Button>
        </div>
      </div>

      {/* Faixa unificada de KPIs (Single-Elevation, sem excesso de ruído) */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-y-0 sm:divide-x xl:grid-cols-4">
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Agendamentos Hoje</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {hojeAgendamentos.length}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              {confirmadosHoje} confirmados · {pendentesConfirmacao.length} aguardando
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Taxa de Ocupação</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {relatorio?.resumo.taxa_ocupacao_pct ?? 0}%
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              {relatorio?.resumo.realizados ?? 0} atendimentos concluídos
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Lista de Espera Ativa</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {listaEspera.length}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500">Pacientes aguardando encaixe</p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Receita Realizada</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-2" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1E3A8A] tabular-nums">
                {formatBRL(relatorio?.resumo.receita_realizada ?? 0)}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500">Inclui procedimentos extras</p>
          </div>
        </div>
      </Card>

      {/* Split Operacional: Agenda do Dia (8 cols) + Fila de Ação (4 cols) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        <Card className="xl:col-span-8 overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 py-4 px-5 sm:px-6">
            <div>
              <CardTitle>Agenda do Dia</CardTitle>
              <CardDescription className="mt-0.5">
                Consultas programadas sem conflito simultâneo de profissional ou sala.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('/agenda')}>
              <span>Ver grade completa</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>

          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : hojeAgendamentos.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-900">Nenhum atendimento marcado para hoje.</p>
              <p className="mt-1 text-sm text-slate-500">
                Abra a Agenda para consultar horários livres ou encaixar pacientes.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Paciente e Procedimento</TableHead>
                  <TableHead className="hidden md:table-cell">Profissional / Local</TableHead>
                  <TableHead>Confirmação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hojeAgendamentos.map((ag) => (
                  <TableRow key={ag.id}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {ag.data_hora_inicio.slice(11, 16)} – {ag.data_hora_fim.slice(11, 16)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900">{ag.cliente_nome}</p>
                      <p className="text-xs text-slate-500">{ag.procedimento_nome}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-xs font-medium text-slate-700">{ag.profissional_nome}</p>
                      <p className="text-xs text-slate-500">{ag.local_nome}</p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                          ag.whatsapp_status === 'Confirmado'
                            ? 'text-emerald-700'
                            : ag.whatsapp_status === 'Cancelado'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        {ag.whatsapp_status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                          ag.status === 'realizado'
                            ? 'text-green-700'
                            : ag.status === 'falta' || ag.status === 'cancelado'
                            ? 'text-red-600'
                            : 'text-[#1E3A8A]'
                        }`}
                      >
                        {ag.status === 'realizado' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : ag.status === 'falta' || ag.status === 'cancelado' ? (
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {ag.status === 'realizado'
                          ? 'Realizado'
                          : ag.status === 'falta'
                          ? 'Falta'
                          : ag.status === 'cancelado'
                          ? 'Cancelado'
                          : 'Agendado'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => onSelectAtendimento(ag.id)}>
                        Atender
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Coluna Direita: Pendências Acionáveis */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-100 py-4 px-5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-amber-600" />
                <span>Aguardando Confirmação ({pendentesConfirmacao.length})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Confirme manualmente após contato ou aguarde o retorno automático via WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-2.5">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : pendentesConfirmacao.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">
                  Todos os atendimentos ativos de hoje já estão confirmados.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendentesConfirmacao.map((ag) => (
                    <div key={ag.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {ag.data_hora_inicio.slice(11, 16)} · {ag.cliente_nome}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{ag.procedimento_nome}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={confirmingId === ag.id}
                        onClick={() => confirmarRapido(ag.id)}
                      >
                        Confirmar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-100 py-4 px-5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListChecks className="h-4 w-4 text-[#1E3A8A]" />
                  <span>Lista de Espera ({listaEspera.length})</span>
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('/agenda')}>
                Abrir
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {listaEspera.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">Nenhum paciente aguardando encaixe.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {listaEspera.slice(0, 4).map((item) => (
                    <div key={item.id} className="p-4 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {item.cliente_nome}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatDateBR(item.data_desejada)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {item.procedimento_nome} · {item.profissional_nome}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
