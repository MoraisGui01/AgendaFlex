/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as React from 'react';
import { Toaster } from 'sonner';
import { Stethoscope } from 'lucide-react';
import { AppShell, type AppRoute } from '@/src/components/layout/AppShell';
import { Skeleton } from '@/src/components/ui/skeleton';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { AdminOverviewPage } from '@/src/pages/AdminOverviewPage';
import { AgendaPage } from '@/src/pages/AgendaPage';
import { AtendimentoPage } from '@/src/pages/AtendimentoPage';
import {
  ClientesPage,
  LocaisPage,
  ProcedimentosPage,
  ProfissionaisPage,
} from '@/src/pages/CadastrosPages';
import { LoginPage } from '@/src/pages/LoginPage';
import { RelatoriosPage } from '@/src/pages/RelatoriosPage';

const VALID_ROUTES: AppRoute[] = [
  '/admin',
  '/admin/locais',
  '/admin/profissionais',
  '/admin/clientes',
  '/admin/procedimentos',
  '/agenda',
  '/atendimento',
  '/relatorios',
];

function resolveRouteFromPath(pathname: string): AppRoute {
  if (VALID_ROUTES.includes(pathname as AppRoute)) {
    return pathname as AppRoute;
  }
  return '/admin';
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const [route, setRoute] = React.useState<AppRoute>(() =>
    resolveRouteFromPath(window.location.pathname)
  );
  const [selectedAtendimentoId, setSelectedAtendimentoId] = React.useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = React.useState(0);

  React.useEffect(() => {
    const onPopState = () => {
      setRoute(resolveRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = React.useCallback((next: AppRoute) => {
    setRoute(next);
    if (window.location.pathname !== next) {
      window.history.pushState({}, '', next);
    }
  }, []);

  const handleSelectAtendimento = React.useCallback(
    (agendamentoId: string) => {
      setSelectedAtendimentoId(agendamentoId);
      navigate('/atendimento');
    },
    [navigate]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E3A8A] text-white">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (route) {
      case '/admin':
        return (
          <AdminOverviewPage
            onNavigate={navigate}
            onSelectAtendimento={handleSelectAtendimento}
            refreshSignal={refreshSignal}
          />
        );
      case '/admin/locais':
        return <LocaisPage />;
      case '/admin/profissionais':
        return <ProfissionaisPage />;
      case '/admin/clientes':
        return <ClientesPage />;
      case '/admin/procedimentos':
        return <ProcedimentosPage />;
      case '/agenda':
        return (
          <AgendaPage
            onSelectAtendimento={handleSelectAtendimento}
            refreshSignal={refreshSignal}
          />
        );
      case '/atendimento':
        return (
          <AtendimentoPage
            selectedAgendamentoId={selectedAtendimentoId}
            onSelectAgendamentoId={setSelectedAtendimentoId}
            refreshSignal={refreshSignal}
          />
        );
      case '/relatorios':
        return <RelatoriosPage refreshSignal={refreshSignal} />;
      default:
        return (
          <AdminOverviewPage
            onNavigate={navigate}
            onSelectAtendimento={handleSelectAtendimento}
            refreshSignal={refreshSignal}
          />
        );
    }
  };

  return (
    <AppShell
      currentRoute={route}
      onNavigate={navigate}
      onRefreshTrigger={() => setRefreshSignal((s) => s + 1)}
    >
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}
