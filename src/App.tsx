/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as React from 'react';
import { Toaster } from 'sonner';
import { AppShell, type AppRoute } from '@/src/components/layout/AppShell';
import { AdminOverviewPage } from '@/src/pages/AdminOverviewPage';
import { AgendaPage } from '@/src/pages/AgendaPage';
import { AtendimentoPage } from '@/src/pages/AtendimentoPage';
import {
  ClientesPage,
  LocaisPage,
  ProcedimentosPage,
  ProfissionaisPage,
} from '@/src/pages/CadastrosPages';
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

export default function App() {
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
    <>
      <AppShell
        currentRoute={route}
        onNavigate={navigate}
        onRefreshTrigger={() => setRefreshSignal((s) => s + 1)}
      >
        {renderPage()}
      </AppShell>
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
