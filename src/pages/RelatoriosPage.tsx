import * as React from 'react';
import { addDays, format, subDays } from 'date-fns';
import { Search, ShieldCheck } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { DateRangePicker, type DateRange } from '@/src/components/ui/date-range-picker';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { apiFetch } from '@/src/lib/api';
import { formatBRL, formatDateTimeBR } from '@/src/lib/utils';
import type { LogAuditoria, RelatorioResponse } from '@/src/types/clinic';

export function RelatoriosPage({ refreshSignal }: { refreshSignal: number }) {
  const [range, setRange] = React.useState<DateRange>(() => ({
    from: subDays(new Date(), 13),
    to: addDays(new Date(), 2),
  }));
  const [loading, setLoading] = React.useState(true);
  const [relatorio, setRelatorio] = React.useState<RelatorioResponse | null>(null);
  const [logs, setLogs] = React.useState<LogAuditoria[]>([]);
  const [auditSearch, setAuditSearch] = React.useState('');

  const loadReports = React.useCallback(async () => {
    setLoading(true);
    try {
      const fromStr = format(range.from, 'yyyy-MM-dd');
      const toStr = format(range.to, 'yyyy-MM-dd');
      const [rel, auditLogs] = await Promise.all([
        apiFetch<RelatorioResponse>(`/api/relatorios?from=${fromStr}&to=${toStr}`),
        apiFetch<LogAuditoria[]>('/api/logs-auditoria?limit=40'),
      ]);
      setRelatorio(rel);
      setLogs(auditLogs);
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [range]);

  React.useEffect(() => {
    loadReports();
  }, [loadReports, refreshSignal]);

  const filteredLogs = React.useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.usuario.toLowerCase().includes(q) ||
        l.acao.toLowerCase().includes(q) ||
        l.entidade.toLowerCase().includes(q) ||
        l.detalhes.toLowerCase().includes(q)
    );
  }, [logs, auditSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Relatórios Analíticos & Auditoria LGPD
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Indicadores de ocupação, produtividade por procedimento, absenteísmo e trilha imutável de logs.
          </p>
        </div>

        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Faixa Unificada de KPIs */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-y-0 sm:divide-x xl:grid-cols-4">
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Total no Período</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {relatorio?.resumo.total_agendamentos ?? 0}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              {relatorio?.resumo.realizados ?? 0} realizados · {relatorio?.resumo.agendados ?? 0} agendados
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Ocupação Média</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1E3A8A] tabular-nums">
                {relatorio?.resumo.taxa_ocupacao_pct ?? 0}%
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500">Aproveitamento diário da grade</p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Faltas & Cancelamentos</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-red-600 tabular-nums">
                {(relatorio?.resumo.faltas ?? 0) + (relatorio?.resumo.cancelados ?? 0)}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              {relatorio?.resumo.faltas ?? 0} faltas · {relatorio?.resumo.cancelados ?? 0} cancelados
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500">Faturamento Realizado</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-2" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {formatBRL(relatorio?.resumo.receita_realizada ?? 0)}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500">Somente atendimentos concluídos</p>
          </div>
        </div>
      </Card>

      {/* Gráficos Recharts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 1. Ocupação da Agenda (Linhas) */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Ocupação da Agenda (%)</CardTitle>
            <CardDescription>Evolução diária de ocupação das salas e profissionais</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : !relatorio || relatorio.ocupacao_diaria.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                Sem dados de agenda para o intervalo selecionado.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={relatorio.ocupacao_diaria}
                    margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748B' }} unit="%" />
                    <Tooltip
                      formatter={(val: any) => [`${val}%`, 'Ocupação']}
                      contentStyle={{
                        borderRadius: '0.75rem',
                        borderColor: '#E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ocupacao_pct"
                      stroke="#1E3A8A"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#1E3A8A' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Taxa de Faltas vs. Realizados (Donut) */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Taxa de Faltas vs. Realizados</CardTitle>
            <CardDescription>Distribuição dos desfechos no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : !relatorio || relatorio.faltas_vs_realizados.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                Nenhum atendimento registrado neste intervalo.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-56 w-full sm:w-56 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={relatorio.faltas_vs_realizados}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {relatorio.faltas_vs_realizados.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '0.75rem',
                          borderColor: '#E2E8F0',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full space-y-2.5">
                  {relatorio.faltas_vs_realizados.map((item) => {
                    const total = relatorio.resumo.total_agendamentos || 1;
                    const pct = Math.round((item.value / total) * 100);
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-xs shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-slate-700">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {item.value} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Procedimentos Mais Realizados (Barras) */}
        <Card className="lg:col-span-12">
          <CardHeader>
            <CardTitle>Procedimentos Mais Realizados</CardTitle>
            <CardDescription>Volume de atendimentos não cancelados por serviço clínico</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : !relatorio || relatorio.procedimentos_mais_realizados.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                Sem procedimentos registrados no período.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={relatorio.procedimentos_mais_realizados}
                    margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val: any) => [val, 'Atendimentos']}
                      contentStyle={{
                        borderRadius: '0.75rem',
                        borderColor: '#E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="quantidade" fill="#1E3A8A" radius={[6, 6, 0, 0]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Logs de Auditoria (logs_auditoria) */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[#1E3A8A]" />
              <span>Logs de Rastreabilidade & Auditoria</span>
            </CardTitle>
            <CardDescription className="mt-0.5">
              Registro automático de usuário, ação e timestamp em todas as alterações da clínica.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filtrar por usuário, ação ou entidade..."
              className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
            />
          </div>
        </CardHeader>
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nenhum evento de auditoria corresponde ao filtro informado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Usuário / Origem</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {formatDateTimeBR(log.created_at)}
                  </TableCell>
                  <TableCell className="font-medium text-slate-800">{log.usuario}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-[#1E3A8A]">
                    {log.acao}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {log.entidade} · <span className="font-mono">{log.entidade_id.slice(0, 12)}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-md truncate font-mono">
                    {log.detalhes}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
