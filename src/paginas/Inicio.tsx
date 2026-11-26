import { CalendarCheck, CalendarDays, Clock, DollarSign, Gauge, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api';
import { formatarData, formatarHora, formatarMoeda, hojeIso } from '@/lib/formato';
import { useDados } from '@/lib/useDados';
import { useNavegacao } from '@/navegacao';
import type { Agendamento, PedidoEspera, Relatorio } from '@/tipos';
import { Botao, Cartao, Carregando, Erro, Indicador, TituloCartao, Vazio } from '@/ui/componentes';
import { SeloStatus, SeloWhatsapp } from '@/ui/status';

export function InicioPagina() {
  const { ir } = useNavegacao();
  const hoje = hojeIso();

  const { dados, carregando, erro, recarregar } = useDados(async () => {
    const [agendaHoje, espera, relatorioMes] = await Promise.all([
      api.get<Agendamento[]>(`/api/agendamentos?data=${hoje}`),
      api.get<PedidoEspera[]>('/api/lista-espera?status=aguardando'),
      api.get<Relatorio>(`/api/relatorios?from=${hoje.slice(0, 8)}01&to=${hoje}`),
    ]);
    return { agendaHoje, espera, relatorioMes };
  });

  if (carregando && !dados) return <Carregando />;
  if (erro || !dados) return <Erro mensagem={erro ?? 'Não foi possível carregar o painel.'} aoTentar={recarregar} />;

  const ativosHoje = dados.agendaHoje.filter((a) => a.status !== 'cancelado');
  const confirmados = ativosHoje.filter((a) => a.whatsapp_status === 'Confirmado').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Atendimentos hoje"
          valor={ativosHoje.length}
          detalhe={`${confirmados} confirmados pelo WhatsApp`}
          icone={<CalendarCheck className="size-5" />}
        />
        <Indicador
          titulo="Ocupação no mês"
          valor={`${dados.relatorioMes.resumo.taxa_ocupacao_pct}%`}
          detalhe="Média diária das salas"
          icone={<Gauge className="size-5" />}
        />
        <Indicador titulo="Lista de espera" valor={dados.espera.length} detalhe="Aguardando encaixe" icone={<Clock className="size-5" />} />
        <Indicador
          titulo="Receita no mês"
          valor={formatarMoeda(dados.relatorioMes.resumo.receita_realizada)}
          detalhe="Atendimentos realizados, com extras"
          icone={<DollarSign className="size-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Cartao className="xl:col-span-2">
          <TituloCartao
            titulo="Agenda de hoje"
            descricao={formatarData(hoje)}
            acoes={
              <Botao variante="secundario" tamanho="p" onClick={() => ir('/agenda')}>
                <CalendarDays className="size-4" /> Abrir agenda
              </Botao>
            }
          />
          {dados.agendaHoje.length === 0 ? (
            <Vazio titulo="Nenhum atendimento marcado para hoje" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dados.agendaHoje.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
                  <span className="w-24 font-semibold tabular-nums text-slate-900">
                    {formatarHora(a.data_hora_inicio)}–{formatarHora(a.data_hora_fim)}
                  </span>
                  <div className="min-w-48 flex-1">
                    <p className="font-medium text-slate-900">{a.cliente_nome}</p>
                    <p className="text-slate-500">
                      {a.procedimento_nome} · {a.profissional_nome} · {a.local_nome}
                    </p>
                  </div>
                  <SeloWhatsapp estado={a.whatsapp_status} />
                  <SeloStatus status={a.status} />
                  {a.status === 'agendado' && (
                    <Botao tamanho="p" variante="secundario" onClick={() => ir('/atendimento', { id: a.id })}>
                      <Stethoscope className="size-3.5" /> Atender
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <TituloCartao titulo="Lista de espera" descricao="Clientes aguardando um horário" />
          {dados.espera.length === 0 ? (
            <Vazio titulo="Ninguém aguardando encaixe" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dados.espera.map((p) => (
                <li key={p.id} className="px-5 py-3 text-sm">
                  <p className="font-medium text-slate-900">{p.cliente_nome}</p>
                  <p className="text-slate-500">
                    {p.procedimento_nome} com {p.profissional_nome}
                  </p>
                  <p className="text-xs text-slate-400">Deseja: {formatarData(p.data_desejada)}</p>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}
