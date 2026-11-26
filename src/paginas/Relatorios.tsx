import { CalendarRange, DollarSign, Gauge, ShieldCheck, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { formatarDataHora, formatarMoeda, hojeIso } from '@/lib/formato';
import { useDados } from '@/lib/useDados';
import type { LogAuditoria, Relatorio } from '@/tipos';
import { Cartao, Carregando, Entrada, Erro, Indicador, TituloCartao, Vazio } from '@/ui/componentes';

export function RelatoriosPagina() {
  const [de, setDe] = useState(hojeIso(-30));
  const [ate, setAte] = useState(hojeIso(7));
  const [filtroLog, setFiltroLog] = useState('');

  const relatorio = useDados(() => api.get<Relatorio>(`/api/relatorios?from=${de}&to=${ate}`), [de, ate]);
  const logs = useDados(() => api.get<LogAuditoria[]>('/api/logs-auditoria?limit=100'));

  const logsFiltrados = useMemo(() => {
    const termo = filtroLog.trim().toLowerCase();
    if (!termo) return logs.dados ?? [];
    return (logs.dados ?? []).filter((l) => [l.usuario, l.acao, l.entidade].some((t) => t.toLowerCase().includes(termo)));
  }, [logs.dados, filtroLog]);

  const r = relatorio.dados;

  return (
    <div className="space-y-6">
      <Cartao className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <CalendarRange className="size-4 text-slate-500" />
        <span className="text-slate-600">Período</span>
        <Entrada type="date" className="h-9 w-40" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} />
        <span className="text-slate-400">até</span>
        <Entrada type="date" className="h-9 w-40" value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} />
      </Cartao>

      {relatorio.erro && <Erro mensagem={relatorio.erro} aoTentar={relatorio.recarregar} />}
      {!r ? (
        <Carregando />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador titulo="Agendamentos" valor={r.resumo.total_agendamentos} detalhe={`${r.resumo.realizados} realizados`} icone={<CalendarRange className="size-5" />} />
            <Indicador titulo="Ocupação média" valor={`${r.resumo.taxa_ocupacao_pct}%`} detalhe="Minutos agendados ÷ capacidade das salas" icone={<Gauge className="size-5" />} />
            <Indicador
              titulo="Faltas e cancelamentos"
              valor={r.resumo.faltas + r.resumo.cancelados}
              detalhe={`${r.resumo.faltas} faltas · ${r.resumo.cancelados} cancelados`}
              icone={<UserX className="size-5" />}
            />
            <Indicador titulo="Faturamento" valor={formatarMoeda(r.resumo.receita_realizada)} detalhe="Só atendimentos concluídos" icone={<DollarSign className="size-5" />} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Cartao className="xl:col-span-2">
              <TituloCartao titulo="Ocupação por dia" descricao="Percentual da capacidade das salas usado em cada dia" />
              <div className="h-72 p-4">
                {r.ocupacao_diaria.length ? (
                  <ResponsiveContainer>
                    <LineChart data={r.ocupacao_diaria}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis unit="%" fontSize={12} domain={[0, 100]} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Ocupação']} />
                      <Line type="monotone" dataKey="ocupacao_pct" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Vazio titulo="Sem atendimentos no período" />
                )}
              </div>
            </Cartao>

            <Cartao>
              <TituloCartao titulo="Desfecho dos agendamentos" />
              <div className="h-72 p-4">
                {r.faltas_vs_realizados.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={r.faltas_vs_realizados} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2} label>
                        {r.faltas_vs_realizados.map((fatia) => (
                          <Cell key={fatia.name} fill={fatia.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Vazio titulo="Sem dados" />
                )}
              </div>
              <ul className="flex flex-wrap justify-center gap-3 px-4 pb-4 text-xs text-slate-600">
                {r.faltas_vs_realizados.map((f) => (
                  <li key={f.name} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: f.color }} /> {f.name} ({f.value})
                  </li>
                ))}
              </ul>
            </Cartao>
          </div>

          <Cartao>
            <TituloCartao titulo="Procedimentos mais procurados" descricao="Quantidade de atendimentos não cancelados" />
            <div className="h-72 p-4">
              {r.procedimentos_mais_realizados.length ? (
                <ResponsiveContainer>
                  <BarChart data={r.procedimentos_mais_realizados} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} fontSize={12} />
                    <YAxis type="category" dataKey="nome" width={180} fontSize={12} />
                    <Tooltip formatter={(v, nome) => (nome === 'receita' ? formatarMoeda(Number(v)) : v)} />
                    <Bar dataKey="quantidade" name="Atendimentos" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Vazio titulo="Sem dados" />
              )}
            </div>
          </Cartao>
        </>
      )}

      <Cartao>
        <TituloCartao
          titulo="Auditoria"
          descricao="Quem fez cada alteração e quando (rastreabilidade exigida pela LGPD)"
          acoes={<ShieldCheck className="size-5 text-azul-700" />}
        />
        <div className="border-b border-slate-100 px-5 py-3">
          <Entrada placeholder="Filtrar por usuário, ação ou entidade…" value={filtroLog} onChange={(e) => setFiltroLog(e.target.value)} />
        </div>
        {logs.carregando && !logs.dados ? (
          <Carregando />
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Quando</th>
                  <th className="px-5 py-2 font-medium">Usuário</th>
                  <th className="px-5 py-2 font-medium">Ação</th>
                  <th className="px-5 py-2 font-medium">Entidade</th>
                  <th className="px-5 py-2 font-medium">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsFiltrados.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-5 py-2 tabular-nums text-slate-500">{formatarDataHora(l.created_at)}</td>
                    <td className="px-5 py-2">{l.usuario}</td>
                    <td className="px-5 py-2 font-mono text-xs">{l.acao}</td>
                    <td className="px-5 py-2">{l.entidade}</td>
                    <td className="max-w-xs truncate px-5 py-2 font-mono text-xs text-slate-500" title={l.detalhes}>
                      {l.detalhes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logsFiltrados.length === 0 && <Vazio titulo="Nenhum registro encontrado" />}
          </div>
        )}
      </Cartao>
    </div>
  );
}
