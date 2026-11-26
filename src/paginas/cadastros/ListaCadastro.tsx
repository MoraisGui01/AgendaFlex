import { Archive, Pencil, Plus, Power, Search } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { api, mensagemDeErro } from '@/lib/api';
import { useDados } from '@/lib/useDados';
import { Botao, Cartao, Carregando, Entrada, Erro, Selecao, Selo, TituloCartao, Vazio } from '@/ui/componentes';

interface Coluna<T> {
  titulo: string;
  valor: (item: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  endpoint: string;
  titulo: string;
  descricao: string;
  nomeItem: string;
  colunas: Coluna<T>[];
  /** Formulário de criação/edição. Recebe o item em edição (ou null para novo). */
  formulario: (props: { item: T | null; aoFechar: () => void; aoSalvar: () => void }) => ReactNode;
}

/**
 * Tela padrão de cadastro: busca, filtro por status, tabela e ações
 * (editar, ativar/inativar e arquivar). Usada por locais, profissionais, clientes e procedimentos.
 */
export function ListaCadastro<T extends { id: string; nome: string; status: 'ativo' | 'inativo' }>(props: Props<T>) {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('todos');
  const [editando, setEditando] = useState<T | null | undefined>(undefined);

  const { dados, carregando, erro, recarregar } = useDados(
    () => api.get<T[]>(`${props.endpoint}?${new URLSearchParams({ search: busca, status })}`),
    [busca, status],
  );

  async function alternarStatus(item: T) {
    const novo = item.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await api.put(`${props.endpoint}/${item.id}`, { status: novo });
      toast.success(`${item.nome} agora está ${novo}.`);
      recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  async function arquivar(item: T) {
    if (!window.confirm(`Arquivar "${item.nome}"? Ele deixa de aparecer nas listas, mas o histórico é mantido.`)) return;
    try {
      await api.delete(`${props.endpoint}/${item.id}`);
      toast.success(`${item.nome} arquivado.`);
      recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  return (
    <Cartao>
      <TituloCartao
        titulo={props.titulo}
        descricao={props.descricao}
        acoes={
          <Botao onClick={() => setEditando(null)}>
            <Plus className="size-4" /> Novo {props.nomeItem}
          </Botao>
        }
      />

      <div className="flex flex-wrap gap-3 border-b border-slate-100 px-5 py-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Entrada className="pl-9" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Selecao className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status">
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </Selecao>
      </div>

      {erro && <Erro mensagem={erro} aoTentar={recarregar} />}
      {carregando && !dados ? (
        <Carregando />
      ) : dados?.length === 0 ? (
        <Vazio titulo="Nenhum registro encontrado" texto="Ajuste a busca ou cadastre um novo item." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {props.colunas.map((c) => (
                  <th key={c.titulo} className={`px-5 py-3 font-medium ${c.className ?? ''}`}>
                    {c.titulo}
                  </th>
                ))}
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dados?.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  {props.colunas.map((c) => (
                    <td key={c.titulo} className={`px-5 py-3 ${c.className ?? ''}`}>
                      {c.valor(item)}
                    </td>
                  ))}
                  <td className="px-5 py-3">
                    <Selo cor={item.status === 'ativo' ? 'verde' : 'cinza'}>{item.status === 'ativo' ? 'Ativo' : 'Inativo'}</Selo>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Botao variante="fantasma" tamanho="p" onClick={() => setEditando(item)} title="Editar">
                        <Pencil className="size-4" />
                      </Botao>
                      <Botao
                        variante="fantasma"
                        tamanho="p"
                        onClick={() => alternarStatus(item)}
                        title={item.status === 'ativo' ? 'Inativar' : 'Reativar'}
                      >
                        <Power className={`size-4 ${item.status === 'ativo' ? 'text-amber-600' : 'text-emerald-600'}`} />
                      </Botao>
                      <Botao variante="fantasma" tamanho="p" onClick={() => arquivar(item)} title="Arquivar">
                        <Archive className="size-4 text-red-600" />
                      </Botao>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando !== undefined &&
        props.formulario({
          item: editando,
          aoFechar: () => setEditando(undefined),
          aoSalvar: () => {
            setEditando(undefined);
            recarregar();
          },
        })}
    </Cartao>
  );
}

/** Envia o formulário (POST para novo, PUT para edição) e mostra o resultado. */
export async function salvarCadastro(endpoint: string, id: string | undefined, dados: unknown, nome: string) {
  try {
    if (id) await api.put(`${endpoint}/${id}`, dados);
    else await api.post(endpoint, dados);
    toast.success(id ? `${nome} atualizado.` : `${nome} cadastrado.`);
    return true;
  } catch (e) {
    toast.error(mensagemDeErro(e));
    return false;
  }
}
