import path from 'node:path';
import express from 'express';
import { criarApi } from './server/app.ts';
import { abrirBanco } from './server/banco/conexao.ts';
import { criarEsquema } from './server/banco/esquema.ts';
import { popularSeVazio } from './server/banco/semente.ts';
import { DATABASE_URL, EMAILS_PERMITIDOS, PORTA, PRODUCAO } from './server/config.ts';

async function iniciar() {
  const banco = await abrirBanco(DATABASE_URL);
  await criarEsquema(banco);
  await popularSeVazio(banco);
  console.log(`[AgendaFlex] Banco: ${banco.tipo === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : 'SQLite local (agendaflex.db)'}`);
  if (EMAILS_PERMITIDOS.size === 0) {
    console.warn('[AgendaFlex] ALLOWED_EMAILS vazio: qualquer conta Google autenticada terá acesso.');
  }

  const app = criarApi(banco);

  if (PRODUCAO) {
    // Em produção o front-end já foi gerado por "npm run build"
    const pastaDist = path.resolve(process.cwd(), 'dist');
    app.use(express.static(pastaDist));
    app.get('*', (_req, res) => res.sendFile(path.join(pastaDist, 'index.html')));
  } else {
    // Em desenvolvimento o Vite serve o React com recarga automática
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORTA, '0.0.0.0', () => {
    console.log(`[AgendaFlex] Servidor em http://localhost:${PORTA}`);
  });
}

iniciar().catch((erro) => {
  console.error('[AgendaFlex] Falha ao iniciar:', erro);
  process.exit(1);
});
