import { type FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { DIAS_SEMANA, formatarData, formatarDuracao, formatarMoeda, idade, mascaraCpf, mascaraTelefone } from '@/lib/formato';
import { useDados } from '@/lib/useDados';
import type { Cliente, Local, Procedimento, Profissional } from '@/tipos';
import { AreaTexto, Botao, Campo, Entrada, Modal, Selo } from '@/ui/componentes';
import { ListaCadastro, salvarCadastro } from './ListaCadastro';

interface PropsFormulario<T> {
  item: T | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}

function Rodape({ salvando, aoFechar }: { salvando: boolean; aoFechar: () => void }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Botao variante="secundario" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao type="submit" carregando={salvando}>
        Salvar
      </Botao>
    </div>
  );
}

/** Estado do formulário + envio, compartilhado pelos quatro cadastros */
function useFormulario<T>(inicial: T, endpoint: string, id: string | undefined, nome: string, aoSalvar: () => void) {
  const [valores, setValores] = useState<T>(inicial);
  const [salvando, setSalvando] = useState(false);
  const alterar = <K extends keyof T>(campo: K, valor: T[K]) => setValores((v) => ({ ...v, [campo]: valor }));
  const enviar = async (e: FormEvent, dados: unknown = valores) => {
    e.preventDefault();
    setSalvando(true);
    const ok = await salvarCadastro(endpoint, id, dados, nome);
    setSalvando(false);
    if (ok) aoSalvar();
  };
  return { valores, alterar, salvando, enviar };
}

// ---------------------------------------------------------------- Locais

function FormularioLocal({ item, aoFechar, aoSalvar }: PropsFormulario<Local>) {
  const h = item?.horario_func;
  const { valores, alterar, salvando, enviar } = useFormulario(
    {
      nome: item?.nome ?? '',
      endereco: item?.endereco ?? '',
      abertura: h?.abertura ?? '08:00',
      fechamento: h?.fechamento ?? '18:00',
      intervalo_inicio: h?.intervalo_inicio ?? '12:00',
      intervalo_fim: h?.intervalo_fim ?? '13:00',
      dias: h?.dias ?? [1, 2, 3, 4, 5],
    },
    '/api/locais',
    item?.id,
    'Local',
    aoSalvar,
  );

  const alternarDia = (dia: number) =>
    alterar('dias', valores.dias.includes(dia) ? valores.dias.filter((d) => d !== dia) : [...valores.dias, dia].sort());

  return (
    <Modal aberto aoFechar={aoFechar} titulo={item ? 'Editar local' : 'Novo local'} descricao="Sala ou unidade onde os atendimentos acontecem.">
      <form
        onSubmit={(e) =>
          enviar(e, {
            nome: valores.nome,
            endereco: valores.endereco,
            horario_func: {
              abertura: valores.abertura,
              fechamento: valores.fechamento,
              dias: valores.dias,
              ...(valores.intervalo_inicio && valores.intervalo_fim
                ? { intervalo_inicio: valores.intervalo_inicio, intervalo_fim: valores.intervalo_fim }
                : {}),
            },
          })
        }
        className="grid gap-4"
      >
        <Campo rotulo="Nome">
          <Entrada required value={valores.nome} onChange={(e) => alterar('nome', e.target.value)} placeholder="Unidade Centro · Consultório 3" />
        </Campo>
        <Campo rotulo="Endereço">
          <Entrada required value={valores.endereco} onChange={(e) => alterar('endereco', e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Abertura">
            <Entrada type="time" required value={valores.abertura} onChange={(e) => alterar('abertura', e.target.value)} />
          </Campo>
          <Campo rotulo="Fechamento">
            <Entrada type="time" required value={valores.fechamento} onChange={(e) => alterar('fechamento', e.target.value)} />
          </Campo>
          <Campo rotulo="Início do intervalo">
            <Entrada type="time" value={valores.intervalo_inicio} onChange={(e) => alterar('intervalo_inicio', e.target.value)} />
          </Campo>
          <Campo rotulo="Fim do intervalo">
            <Entrada type="time" value={valores.intervalo_fim} onChange={(e) => alterar('intervalo_fim', e.target.value)} />
          </Campo>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Dias de funcionamento</legend>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((nome, dia) => (
              <button
                key={nome}
                type="button"
                onClick={() => alternarDia(dia)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  valores.dias.includes(dia) ? 'border-azul-600 bg-azul-50 text-azul-700' : 'border-slate-300 text-slate-500'
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
        </fieldset>
        <Rodape salvando={salvando} aoFechar={aoFechar} />
      </form>
    </Modal>
  );
}

export function LocaisPagina() {
  return (
    <ListaCadastro<Local>
      endpoint="/api/locais"
      titulo="Locais e consultórios"
      descricao="Salas e unidades com seus horários de funcionamento."
      nomeItem="local"
      colunas={[
        {
          titulo: 'Local',
          valor: (l) => (
            <>
              <p className="font-medium text-slate-900">{l.nome}</p>
              <p className="text-xs text-slate-500">{l.endereco}</p>
            </>
          ),
        },
        {
          titulo: 'Funcionamento',
          valor: (l) => (
            <>
              <p>
                {l.horario_func.abertura}–{l.horario_func.fechamento}
                {l.horario_func.intervalo_inicio && (
                  <span className="text-slate-400">
                    {' '}
                    (intervalo {l.horario_func.intervalo_inicio}–{l.horario_func.intervalo_fim})
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">{l.horario_func.dias.map((d) => DIAS_SEMANA[d]).join(', ')}</p>
            </>
          ),
        },
      ]}
      formulario={(p) => <FormularioLocal {...p} />}
    />
  );
}

// ---------------------------------------------------------------- Procedimentos

function FormularioProcedimento({ item, aoFechar, aoSalvar }: PropsFormulario<Procedimento>) {
  const { valores, alterar, salvando, enviar } = useFormulario(
    {
      nome: item?.nome ?? '',
      duracao_min: item?.duracao_min ?? 30,
      valor: item?.valor ?? 0,
      orientacoes: item?.orientacoes ?? '',
    },
    '/api/procedimentos',
    item?.id,
    'Procedimento',
    aoSalvar,
  );

  return (
    <Modal aberto aoFechar={aoFechar} titulo={item ? 'Editar procedimento' : 'Novo procedimento'}>
      <form onSubmit={enviar} className="grid gap-4">
        <Campo rotulo="Nome">
          <Entrada required value={valores.nome} onChange={(e) => alterar('nome', e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Duração (minutos)">
            <Entrada type="number" min={5} step={5} required value={valores.duracao_min} onChange={(e) => alterar('duracao_min', Number(e.target.value))} />
          </Campo>
          <Campo rotulo="Valor (R$)">
            <Entrada type="number" min={0} step="0.01" required value={valores.valor} onChange={(e) => alterar('valor', Number(e.target.value))} />
          </Campo>
        </div>
        <Campo rotulo="Orientações ao cliente">
          <AreaTexto value={valores.orientacoes} onChange={(e) => alterar('orientacoes', e.target.value)} placeholder="Preparos antes do atendimento" />
        </Campo>
        <Rodape salvando={salvando} aoFechar={aoFechar} />
      </form>
    </Modal>
  );
}

export function ProcedimentosPagina() {
  return (
    <ListaCadastro<Procedimento>
      endpoint="/api/procedimentos"
      titulo="Procedimentos"
      descricao="Serviços oferecidos, com duração e valor usados na agenda."
      nomeItem="procedimento"
      colunas={[
        {
          titulo: 'Procedimento',
          valor: (p) => (
            <>
              <p className="font-medium text-slate-900">{p.nome}</p>
              {p.orientacoes && <p className="max-w-md truncate text-xs text-slate-500">{p.orientacoes}</p>}
            </>
          ),
        },
        { titulo: 'Duração', valor: (p) => formatarDuracao(p.duracao_min) },
        { titulo: 'Valor', valor: (p) => formatarMoeda(p.valor), className: 'tabular-nums' },
      ]}
      formulario={(p) => <FormularioProcedimento {...p} />}
    />
  );
}

// ---------------------------------------------------------------- Profissionais

function FormularioProfissional({ item, aoFechar, aoSalvar }: PropsFormulario<Profissional>) {
  const { dados: procedimentos } = useDados(() => api.get<Procedimento[]>('/api/procedimentos?status=ativo'));
  const { valores, alterar, salvando, enviar } = useFormulario(
    {
      nome: item?.nome ?? '',
      cpf: item?.cpf ?? '',
      registro_conselho: item?.registro_conselho ?? '',
      especialidade: item?.especialidade ?? '',
      procedimentos_vinculados: item?.procedimentos_vinculados ?? [],
    },
    '/api/profissionais',
    item?.id,
    'Profissional',
    aoSalvar,
  );

  const alternar = (id: string) =>
    alterar(
      'procedimentos_vinculados',
      valores.procedimentos_vinculados.includes(id)
        ? valores.procedimentos_vinculados.filter((p) => p !== id)
        : [...valores.procedimentos_vinculados, id],
    );

  return (
    <Modal aberto aoFechar={aoFechar} titulo={item ? 'Editar profissional' : 'Novo profissional'}>
      <form onSubmit={enviar} className="grid gap-4">
        <Campo rotulo="Nome completo">
          <Entrada required value={valores.nome} onChange={(e) => alterar('nome', e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="CPF">
            <Entrada required value={valores.cpf} onChange={(e) => alterar('cpf', mascaraCpf(e.target.value))} placeholder="000.000.000-00" />
          </Campo>
          <Campo rotulo="Registro no conselho">
            <Entrada value={valores.registro_conselho} onChange={(e) => alterar('registro_conselho', e.target.value)} placeholder="CRM-GO 00.000" />
          </Campo>
        </div>
        <Campo rotulo="Especialidade">
          <Entrada required value={valores.especialidade} onChange={(e) => alterar('especialidade', e.target.value)} />
        </Campo>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Procedimentos que realiza</legend>
          <p className="mb-2 text-xs text-slate-500">Sem nenhum marcado, o profissional pode ser agendado para qualquer procedimento.</p>
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {procedimentos?.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={valores.procedimentos_vinculados.includes(p.id)} onChange={() => alternar(p.id)} />
                {p.nome}
              </label>
            ))}
          </div>
        </fieldset>
        <Rodape salvando={salvando} aoFechar={aoFechar} />
      </form>
    </Modal>
  );
}

export function ProfissionaisPagina() {
  return (
    <ListaCadastro<Profissional>
      endpoint="/api/profissionais"
      titulo="Profissionais"
      descricao="Equipe de atendimento e os procedimentos de cada um."
      nomeItem="profissional"
      colunas={[
        {
          titulo: 'Profissional',
          valor: (p) => (
            <>
              <p className="font-medium text-slate-900">{p.nome}</p>
              <p className="text-xs text-slate-500">CPF {p.cpf}</p>
            </>
          ),
        },
        { titulo: 'Especialidade', valor: (p) => p.especialidade },
        { titulo: 'Registro', valor: (p) => p.registro_conselho || '—' },
        {
          titulo: 'Procedimentos',
          valor: (p) => (p.procedimentos_vinculados.length ? `${p.procedimentos_vinculados.length} vinculados` : 'Todos'),
        },
      ]}
      formulario={(p) => <FormularioProfissional {...p} />}
    />
  );
}

// ---------------------------------------------------------------- Clientes

function FormularioCliente({ item, aoFechar, aoSalvar }: PropsFormulario<Cliente>) {
  const { valores, alterar, salvando, enviar } = useFormulario(
    {
      nome: item?.nome ?? '',
      whatsapp: item?.whatsapp ?? '',
      nascimento: item?.nascimento ?? '',
      lgpd_consentimento: item?.lgpd_consentimento ?? false,
    },
    '/api/clientes',
    item?.id,
    'Cliente',
    aoSalvar,
  );

  return (
    <Modal aberto aoFechar={aoFechar} titulo={item ? 'Editar cliente' : 'Novo cliente'}>
      <form onSubmit={enviar} className="grid gap-4">
        <Campo rotulo="Nome completo">
          <Entrada required value={valores.nome} onChange={(e) => alterar('nome', e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="WhatsApp">
            <Entrada required value={valores.whatsapp} onChange={(e) => alterar('whatsapp', mascaraTelefone(e.target.value))} placeholder="(62) 99999-0000" />
          </Campo>
          <Campo rotulo="Data de nascimento">
            <Entrada type="date" required value={valores.nascimento} onChange={(e) => alterar('nascimento', e.target.value)} />
          </Campo>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-azul-100 bg-azul-50 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            required={!item}
            checked={valores.lgpd_consentimento}
            onChange={(e) => alterar('lgpd_consentimento', e.target.checked)}
          />
          <span>
            O cliente autorizou o uso dos dados pessoais para agendamento e contato pelo WhatsApp, conforme a LGPD (Lei 13.709/2018).
          </span>
        </label>
        <Rodape salvando={salvando} aoFechar={aoFechar} />
      </form>
    </Modal>
  );
}

export function ClientesPagina() {
  return (
    <ListaCadastro<Cliente>
      endpoint="/api/clientes"
      titulo="Clientes"
      descricao="Pessoas atendidas, com o registro de consentimento da LGPD."
      nomeItem="cliente"
      colunas={[
        {
          titulo: 'Cliente',
          valor: (c) => (
            <>
              <p className="font-medium text-slate-900">{c.nome}</p>
              <p className="text-xs text-slate-500">
                {formatarData(c.nascimento)} · {idade(c.nascimento)} anos
              </p>
            </>
          ),
        },
        { titulo: 'WhatsApp', valor: (c) => c.whatsapp, className: 'tabular-nums' },
        {
          titulo: 'LGPD',
          valor: (c) =>
            c.lgpd_consentimento ? (
              <Selo cor="verde">Consentiu em {formatarData(c.lgpd_consentimento_em)}</Selo>
            ) : (
              <Selo cor="amarelo">Sem consentimento</Selo>
            ),
        },
      ]}
      formulario={(p) => <FormularioCliente {...p} />}
    />
  );
}
