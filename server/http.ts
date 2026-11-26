import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

/** Erro com status HTTP: lançado nas rotas e transformado em resposta JSON pelo tratador central. */
export class ErroHttp extends Error {
  constructor(
    public readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const naoEncontrado = (mensagem: string) => new ErroHttp(404, mensagem);
export const requisicaoInvalida = (mensagem: string) => new ErroHttp(400, mensagem);
export const conflito = (mensagem: string) => new ErroHttp(409, mensagem);

/** O Express 4 não captura erros de funções async; este invólucro encaminha para o tratador. */
export function rota(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

/** Valida o corpo/consulta com Zod e devolve os dados já convertidos. */
export function validar<T>(esquema: ZodType<T>, dados: unknown): T {
  const resultado = esquema.safeParse(dados);
  if (!resultado.success) {
    throw requisicaoInvalida(resultado.error.issues[0]?.message ?? 'Dados inválidos.');
  }
  return resultado.data;
}

export function tratadorDeErros(erro: any, _req: Request, res: Response, _next: NextFunction) {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ error: erro.message });
  }
  if (erro?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }
  console.error('[AgendaFlex] Erro inesperado:', erro);
  return res.status(500).json({ error: 'Erro interno no servidor.' });
}
