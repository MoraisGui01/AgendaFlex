import express, { type RequestHandler } from 'express';
import { exigirLogin } from './auth.ts';
import type { Banco } from './banco/conexao.ts';
import { tratadorDeErros } from './http.ts';
import { rotasAgendamentos } from './rotas/agendamentos.ts';
import { rotasCadastros } from './rotas/cadastros.ts';
import { rotasListaEspera } from './rotas/listaEspera.ts';
import { rotasRelatorios } from './rotas/relatorios.ts';
import { rotasSessao } from './rotas/sessao.ts';
import { rotasWhatsapp } from './rotas/whatsapp.ts';

/**
 * Monta a API. A autenticação pode ser trocada nos testes.
 */
export function criarApi(banco: Banco, autenticacao: RequestHandler = exigirLogin) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Rota pública usada para saber se o servidor está no ar
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, servico: 'AgendaFlex API', banco: banco.tipo });
  });

  // Daqui para baixo, só com login Google
  const api = express.Router();
  api.use(autenticacao);
  api.use(rotasSessao(banco));
  api.use(rotasCadastros(banco));
  api.use(rotasAgendamentos(banco));
  api.use(rotasListaEspera(banco));
  api.use(rotasWhatsapp(banco));
  api.use(rotasRelatorios(banco));
  api.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  app.use('/api', api);
  app.use(tratadorDeErros);
  return app;
}
