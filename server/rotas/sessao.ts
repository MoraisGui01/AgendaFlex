import { Router } from 'express';
import { operador } from '../auth.ts';
import { auditar } from '../auditoria.ts';
import type { Banco } from '../banco/conexao.ts';
import { rota, validar } from '../http.ts';
import { eventoSessaoSchema } from '../validacao.ts';

export function rotasSessao(banco: Banco): Router {
  const router = Router();

  // Chamado logo após o login: se chegou aqui, a conta tem acesso
  router.get(
    '/auth/me',
    rota(async (req, res) => {
      res.json({ ok: true, ...req.usuario });
    }),
  );

  // Registra entrada e saída no log de auditoria
  router.post(
    '/auth/audit',
    rota(async (req, res) => {
      const { evento } = validar(eventoSessaoSchema, req.body);
      await auditar(banco, {
        usuario: operador(req),
        acao: evento,
        entidade: 'autenticacao',
        entidade_id: req.usuario?.uid ?? 'desconhecido',
        detalhes: { email: req.usuario?.email ?? '', provedor: 'google.com' },
      });
      res.status(201).json({ ok: true });
    }),
  );

  return router;
}
