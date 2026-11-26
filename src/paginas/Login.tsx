import { CalendarDays, ShieldCheck } from 'lucide-react';
import { useAutenticacao } from '@/auth/Autenticacao';
import { Botao } from '@/ui/componentes';

export function LoginPagina() {
  const { entrar, entrando, erro } = useAutenticacao();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-azul-900 to-azul-700 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2 text-azul-900">
          <CalendarDays className="size-7" />
          <span className="text-2xl font-bold">AgendaFlex</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">Agenda, atendimentos e relatórios da sua clínica em um só lugar.</p>

        <h1 className="mt-8 text-lg font-semibold text-slate-900">Entrar</h1>
        <p className="mt-1 text-sm text-slate-500">Use a conta Google liberada pela clínica.</p>

        <Botao className="mt-6 w-full" onClick={entrar} carregando={entrando}>
          {!entrando && (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
              <path fill="#fff" opacity=".85" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
              <path fill="#fff" opacity=".7" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" />
              <path fill="#fff" opacity=".55" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" />
            </svg>
          )}
          Entrar com Google
        </Botao>

        {erro && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <p className="mt-8 flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="size-4" /> Acesso registrado em log de auditoria (LGPD).
        </p>
      </div>
    </div>
  );
}
