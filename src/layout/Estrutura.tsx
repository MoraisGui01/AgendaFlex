import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useAutenticacao } from '@/auth/Autenticacao';
import { cn } from '@/lib/formato';
import { useNavegacao } from '@/navegacao';
import { Botao } from '@/ui/componentes';
import { PainelWhatsapp } from './PainelWhatsapp';

const MENU = [
  {
    grupo: 'Operação',
    itens: [
      { caminho: '/admin', rotulo: 'Visão geral', icone: LayoutDashboard },
      { caminho: '/agenda', rotulo: 'Agenda', icone: CalendarDays },
      { caminho: '/atendimento', rotulo: 'Atendimento', icone: Stethoscope },
      { caminho: '/relatorios', rotulo: 'Relatórios', icone: BarChart3 },
    ],
  },
  {
    grupo: 'Cadastros',
    itens: [
      { caminho: '/admin/locais', rotulo: 'Locais', icone: Building2 },
      { caminho: '/admin/profissionais', rotulo: 'Profissionais', icone: UserRound },
      { caminho: '/admin/clientes', rotulo: 'Clientes', icone: Users },
      { caminho: '/admin/procedimentos', rotulo: 'Procedimentos', icone: ClipboardList },
    ],
  },
];

export function Estrutura({ children }: { children: ReactNode }) {
  const { usuario, sair } = useAutenticacao();
  const { caminho, ir } = useNavegacao();
  const [menuAberto, setMenuAberto] = useState(false);
  const [whatsappAberto, setWhatsappAberto] = useState(false);

  const atual = MENU.flatMap((g) => g.itens).find((i) => i.caminho === caminho) ?? MENU[0].itens[0];

  const menu = (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      {MENU.map((grupo) => (
        <div key={grupo.grupo}>
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-azul-100/60">{grupo.grupo}</p>
          <ul className="space-y-1">
            {grupo.itens.map(({ caminho: destino, rotulo, icone: Icone }) => (
              <li key={destino}>
                <button
                  type="button"
                  onClick={() => {
                    ir(destino);
                    setMenuAberto(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    destino === atual.caminho ? 'bg-white/15 font-medium text-white' : 'text-azul-100 hover:bg-white/10',
                  )}
                >
                  <Icone className="size-4" />
                  {rotulo}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  const barraLateral = (
    <div className="flex h-full flex-col bg-azul-900">
      <div className="flex items-center gap-2 px-6 py-5 text-white">
        <CalendarDays className="size-6" />
        <span className="text-lg font-semibold">AgendaFlex</span>
      </div>
      {menu}
      <div className="m-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-azul-100">
        <ShieldCheck className="size-4 shrink-0" /> Dados tratados conforme a LGPD
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{barraLateral}</aside>

      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuAberto(false)} />
          <aside className="relative h-full w-64">
            {barraLateral}
            <button
              type="button"
              className="absolute right-3 top-5 text-white"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button type="button" className="lg:hidden" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
          <Menu className="size-5 text-slate-600" />
        </button>
        <h1 className="font-semibold text-slate-900">{atual.rotulo}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Botao variante="secundario" tamanho="p" onClick={() => setWhatsappAberto(true)}>
            <MessageCircle className="size-4 text-emerald-600" /> WhatsApp
          </Botao>
          <div className="hidden text-right text-xs sm:block">
            <p className="font-medium text-slate-800">{usuario?.displayName}</p>
            <p className="text-slate-500">{usuario?.email}</p>
          </div>
          {usuario?.photoURL && <img src={usuario.photoURL} alt="" className="size-8 rounded-full" referrerPolicy="no-referrer" />}
          <Botao variante="fantasma" tamanho="p" onClick={sair} title="Sair da conta">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sair</span>
          </Botao>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>

      <PainelWhatsapp aberto={whatsappAberto} aoFechar={() => setWhatsappAberto(false)} />
    </div>
  );
}
