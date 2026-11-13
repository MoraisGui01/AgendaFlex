import * as React from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { getCurrentOperator, setCurrentOperator } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import { WhatsAppPanelDialog } from './WhatsAppPanelDialog';

export type AppRoute =
  | '/admin'
  | '/admin/locais'
  | '/admin/profissionais'
  | '/admin/clientes'
  | '/admin/procedimentos'
  | '/agenda'
  | '/atendimento'
  | '/relatorios';

interface NavItem {
  route: AppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Operação' | 'Cadastros';
}

const NAV_ITEMS: NavItem[] = [
  { route: '/admin', label: 'Visão Geral', icon: LayoutDashboard, group: 'Operação' },
  { route: '/agenda', label: 'Agenda', icon: CalendarDays, group: 'Operação' },
  { route: '/atendimento', label: 'Atendimento', icon: Activity, group: 'Operação' },
  { route: '/relatorios', label: 'Relatórios', icon: BarChart3, group: 'Operação' },
  { route: '/admin/locais', label: 'Locais', icon: Building2, group: 'Cadastros' },
  { route: '/admin/profissionais', label: 'Profissionais', icon: UserCheck, group: 'Cadastros' },
  { route: '/admin/clientes', label: 'Clientes', icon: Users, group: 'Cadastros' },
  { route: '/admin/procedimentos', label: 'Procedimentos', icon: ClipboardList, group: 'Cadastros' },
];

const ROUTE_BREADCRUMBS: Record<AppRoute, string[]> = {
  '/admin': ['Administração', 'Visão Geral'],
  '/agenda': ['Operação Clínica', 'Agenda & Disponibilidade'],
  '/atendimento': ['Operação Clínica', 'Prontuário & Atendimento'],
  '/relatorios': ['Inteligência & LGPD', 'Relatórios e Auditoria'],
  '/admin/locais': ['Administração', 'Locais'],
  '/admin/profissionais': ['Administração', 'Profissionais'],
  '/admin/clientes': ['Administração', 'Clientes'],
  '/admin/procedimentos': ['Administração', 'Procedimentos'],
};

interface AppShellProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onRefreshTrigger?: () => void;
  children: React.ReactNode;
}

export function AppShell({ currentRoute, onNavigate, onRefreshTrigger, children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [whatsappOpen, setWhatsappOpen] = React.useState(false);
  const [operator, setOperator] = React.useState(getCurrentOperator());

  const handleOperatorChange = (val: string) => {
    setOperator(val);
    setCurrentOperator(val);
  };

  const breadcrumbs = ROUTE_BREADCRUMBS[currentRoute] ?? ['Administração'];

  const renderNavLinks = (isMobile = false) => (
    <div className="flex flex-col gap-6 px-3 py-5">
      {(['Operação', 'Cadastros'] as const).map((group) => (
        <div key={group} className="space-y-1.5">
          <p className="px-3 text-xs font-semibold text-slate-400">{group}</p>
          <nav className="space-y-1" aria-label={group}>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              const active = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => {
                    onNavigate(item.route);
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={cn(
                    'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    active
                      ? 'bg-[#EFF6FF] text-[#1E3A8A] font-semibold'
                      : 'text-slate-600 font-medium hover:bg-slate-100/80 hover:text-slate-900'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      active ? 'text-[#1E3A8A]' : 'text-slate-400'
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="mt-auto border-t border-slate-100 pt-4 px-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <ShieldCheck className="h-4 w-4 text-[#1E3A8A] shrink-0" />
          <span>Ambiente LGPD Ativo</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          RLS por clínica, exclusão lógica e trilha de auditoria em tempo real.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Sidebar fixa no Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white z-30">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A8A] text-white shrink-0">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[15px] font-bold tracking-tight text-slate-900 whitespace-nowrap">
              AgendaFlex
            </span>
            <span className="block text-[11px] font-medium text-slate-500 truncate">
              Clínica Paulista Integrada
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{renderNavLinks(false)}</div>
      </aside>

      {/* Drawer Mobile Colapsável */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white border-r border-slate-200 h-full shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A8A] text-white">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <span className="text-[15px] font-bold tracking-tight text-slate-900">AgendaFlex</span>
              </div>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderNavLinks(true)}</div>
          </aside>
        </div>
      ) : null}

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 backdrop-blur-xs px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              aria-label="Abrir navegação"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="hidden sm:inline font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap cursor-pointer"
              >
                AgendaFlex
              </button>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb}>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 text-slate-300 shrink-0',
                      idx === 0 && 'hidden sm:inline'
                    )}
                  />
                  <span
                    className={cn(
                      'truncate',
                      idx === breadcrumbs.length - 1
                        ? 'font-semibold text-slate-900'
                        : 'hidden md:inline text-slate-500'
                    )}
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setWhatsappOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">WhatsApp: Conectado</span>
              <span className="sm:hidden">WhatsApp</span>
            </button>

            <div className="hidden md:block w-56">
              <Select value={operator} onValueChange={handleOperatorChange}>
                <SelectTrigger className="min-h-[44px] text-xs" aria-label="Operador ativo para auditoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dra. Camila Mendes (Admin)">Dra. Camila Mendes (Admin)</SelectItem>
                  <SelectItem value="Dra. Helena Vasconcelos">Dra. Helena Vasconcelos</SelectItem>
                  <SelectItem value="Recepção Central">Recepção Central</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      <WhatsAppPanelDialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        onMutated={onRefreshTrigger}
      />
    </div>
  );
}
