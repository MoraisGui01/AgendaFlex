import { Loader2, X } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
} from 'react';
import { cn } from '@/lib/formato';

// Componentes visuais básicos, feitos só com Tailwind

type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'sucesso';

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-azul-700 text-white hover:bg-azul-800 focus-visible:ring-azul-500',
  secundario: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-azul-500',
  perigo: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
  fantasma: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-azul-500',
};

interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: 'p' | 'm';
  carregando?: boolean;
}

export function Botao({ variante = 'primario', tamanho = 'm', carregando, className, children, disabled, ...props }: PropsBotao) {
  return (
    <button
      type="button"
      disabled={disabled || carregando}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
        tamanho === 'p' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        VARIANTES[variante],
        className,
      )}
      {...props}
    >
      {carregando && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</section>;
}

export function TituloCartao({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="font-semibold text-slate-900">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>}
      </div>
      {acoes}
    </header>
  );
}

export function Campo({ rotulo, erro, children, className }: { rotulo: string; erro?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-sm', className)}>
      <span className="font-medium text-slate-700">{rotulo}</span>
      {children}
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </label>
  );
}

const estiloEntrada =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-azul-500 focus:outline-none focus:ring-2 focus:ring-azul-500/20 disabled:bg-slate-100';

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(estiloEntrada, className)} {...props} />;
}

export function Selecao({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(estiloEntrada, 'pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function AreaTexto({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(estiloEntrada, 'h-auto min-h-20 py-2', className)} {...props} />;
}

const CORES_SELO = {
  cinza: 'bg-slate-100 text-slate-700',
  azul: 'bg-azul-50 text-azul-700',
  verde: 'bg-emerald-50 text-emerald-700',
  amarelo: 'bg-amber-50 text-amber-700',
  vermelho: 'bg-red-50 text-red-700',
};

export function Selo({ cor = 'cinza', children }: { cor?: keyof typeof CORES_SELO; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', CORES_SELO[cor])}>{children}</span>;
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  largura = 'max-w-lg',
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  largura?: string;
}) {
  // Fecha com a tecla Esc
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onMouseDown={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn('w-full rounded-xl bg-white shadow-xl', largura)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>}
          </div>
          <button type="button" onClick={aoFechar} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Vazio({ icone, titulo, texto }: { icone?: ReactNode; titulo: string; texto?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-slate-500">
      {icone && <div className="text-slate-300">{icone}</div>}
      <p className="font-medium text-slate-700">{titulo}</p>
      {texto && <p className="max-w-sm text-sm">{texto}</p>}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" /> {texto}
    </div>
  );
}

export function Erro({ mensagem, aoTentar }: { mensagem: string; aoTentar?: () => void }) {
  return (
    <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{mensagem}</span>
      {aoTentar && (
        <Botao variante="secundario" tamanho="p" onClick={aoTentar}>
          Tentar novamente
        </Botao>
      )}
    </div>
  );
}

export function Indicador({ titulo, valor, detalhe, icone }: { titulo: string; valor: ReactNode; detalhe?: string; icone: ReactNode }) {
  return (
    <Cartao className="flex items-start gap-4 p-5">
      <div className="rounded-lg bg-azul-50 p-2.5 text-azul-700">{icone}</div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{titulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{valor}</p>
        {detalhe && <p className="mt-0.5 text-xs text-slate-400">{detalhe}</p>}
      </div>
    </Cartao>
  );
}
