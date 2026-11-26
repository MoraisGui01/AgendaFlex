import { tokenAtual } from './firebase';

export class ErroApi extends Error {
  constructor(
    mensagem: string,
    public readonly status: number,
  ) {
    super(mensagem);
  }
}

async function requisitar(metodo: string, url: string, corpo?: unknown, renovarToken = false): Promise<Response> {
  const token = await tokenAtual(renovarToken);
  const cabecalhos: Record<string, string> = {};
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

  return fetch(url, {
    method: metodo,
    headers: cabecalhos,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

/** Chama a API com o token do Firebase. Se o token expirou (401), renova e tenta mais uma vez. */
async function chamar<T>(metodo: string, url: string, corpo?: unknown): Promise<T> {
  let resposta = await requisitar(metodo, url, corpo);
  if (resposta.status === 401) resposta = await requisitar(metodo, url, corpo, true);

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(dados.error ?? `Erro na requisição (${resposta.status}).`, resposta.status);
  }
  return dados as T;
}

export const api = {
  get: <T>(url: string) => chamar<T>('GET', url),
  post: <T>(url: string, corpo?: unknown) => chamar<T>('POST', url, corpo ?? {}),
  put: <T>(url: string, corpo: unknown) => chamar<T>('PUT', url, corpo),
  patch: <T>(url: string, corpo: unknown) => chamar<T>('PATCH', url, corpo),
  delete: <T>(url: string) => chamar<T>('DELETE', url),
};

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Algo deu errado. Tente novamente.';
}
