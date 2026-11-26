import { Loader2 } from 'lucide-react';
import type { ComponentType } from 'react';
import { Toaster } from 'sonner';
import { ProvedorAutenticacao, useAutenticacao } from './auth/Autenticacao';
import { Estrutura } from './layout/Estrutura';
import { ProvedorNavegacao, useNavegacao } from './navegacao';
import { AgendaPagina } from './paginas/Agenda';
import { AtendimentoPagina } from './paginas/Atendimento';
import { ClientesPagina, LocaisPagina, ProcedimentosPagina, ProfissionaisPagina } from './paginas/cadastros';
import { InicioPagina } from './paginas/Inicio';
import { LoginPagina } from './paginas/Login';
import { RelatoriosPagina } from './paginas/Relatorios';

const PAGINAS: Record<string, ComponentType> = {
  '/admin': InicioPagina,
  '/agenda': AgendaPagina,
  '/atendimento': AtendimentoPagina,
  '/relatorios': RelatoriosPagina,
  '/admin/locais': LocaisPagina,
  '/admin/profissionais': ProfissionaisPagina,
  '/admin/clientes': ClientesPagina,
  '/admin/procedimentos': ProcedimentosPagina,
};

function Conteudo() {
  const { usuario, verificando } = useAutenticacao();
  const { caminho } = useNavegacao();

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500">
        <Loader2 className="size-5 animate-spin" /> Verificando sessão…
      </div>
    );
  }
  if (!usuario) return <LoginPagina />;

  const Pagina = PAGINAS[caminho] ?? InicioPagina;
  return (
    <Estrutura>
      <Pagina />
    </Estrutura>
  );
}

export default function App() {
  return (
    <ProvedorAutenticacao>
      <ProvedorNavegacao>
        <Conteudo />
      </ProvedorNavegacao>
      <Toaster position="top-right" richColors closeButton />
    </ProvedorAutenticacao>
  );
}
