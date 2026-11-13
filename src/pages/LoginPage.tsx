import { AlertCircle, LockKeyhole, ShieldCheck, Stethoscope } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { useAuth } from '@/src/contexts/AuthContext';

export function LoginPage() {
  const { signInWithGoogle, signingIn, authError } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E3A8A] text-white shadow-sm">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">AgendaFlex</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestão Clínica Inteligente · Clínica Paulista Integrada
          </p>
        </div>

        <Card className="border-slate-200 bg-white rounded-xl shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <h2 className="text-lg font-semibold text-slate-900">Acesse sua conta</h2>
              <p className="text-sm leading-relaxed text-slate-500">
                Entre com sua conta Google corporativa ou clínica para acessar a agenda, prontuários e relatórios.
              </p>
            </div>

            {authError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{authError}</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={signingIn}
              className="w-full min-h-[48px] flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{signingIn ? 'Autenticando com o Google...' : 'Entrar com o Google'}</span>
            </button>

            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-[#1E3A8A] shrink-0 mt-0.5" />
                <span>
                  Todas as ações são autenticadas e registradas na trilha de auditoria em conformidade com a LGPD.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <LockKeyhole className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Sessão criptografada via OAuth Google (Firebase Authentication).
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
