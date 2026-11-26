import crypto from 'node:crypto';
import { Router } from 'express';
import { operador } from '../auth.ts';
import { auditar } from '../auditoria.ts';
import type { Banco } from '../banco/conexao.ts';
import { CLINICA_ID } from '../config.ts';
import { naoEncontrado, rota, validar } from '../http.ts';
import { listaEsperaSchema, statusListaEsperaSchema } from '../validacao.ts';

export function rotasListaEspera(banco: Banco): Router {
  const router = Router();

  router.get(
    '/lista-espera',
    rota(async (req, res) => {
      const status = String(req.query.status ?? 'todos');
      const linhas = await banco.todos(
        `SELECT le.*,
                c.nome AS cliente_nome, c.whatsapp AS cliente_whatsapp,
                pr.nome AS profissional_nome, p.nome AS procedimento_nome, l.nome AS local_nome
         FROM lista_espera le
         JOIN clientes c ON c.id = le.cliente_id
         JOIN profissionais pr ON pr.id = le.profissional_id
         JOIN procedimentos p ON p.id = le.procedimento_id
         JOIN locais l ON l.id = le.local_id
         WHERE le.clinica_id = ?
         ORDER BY le.data_desejada, le.created_at`,
        [CLINICA_ID],
      );
      res.json(status === 'todos' ? linhas : linhas.filter((l) => l.status === status));
    }),
  );

  router.post(
    '/lista-espera',
    rota(async (req, res) => {
      const dados = validar(listaEsperaSchema, req.body);

      const verificacoes: Array<[string, string, string]> = [
        ['clientes', dados.cliente_id, 'Cliente'],
        ['profissionais', dados.profissional_id, 'Profissional'],
        ['procedimentos', dados.procedimento_id, 'Procedimento'],
        ['locais', dados.local_id, 'Local'],
      ];
      for (const [tabela, id, nome] of verificacoes) {
        const existe = await banco.um(`SELECT id FROM ${tabela} WHERE id = ? AND deleted_at IS NULL`, [id]);
        if (!existe) throw naoEncontrado(`${nome} não encontrado.`);
      }

      const id = crypto.randomUUID();
      const agora = new Date().toISOString();
      await banco.transacao(async (tx) => {
        await tx.executar(
          `INSERT INTO lista_espera (id, clinica_id, cliente_id, profissional_id, procedimento_id, local_id, data_desejada, observacoes, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aguardando', ?)`,
          [id, CLINICA_ID, dados.cliente_id, dados.profissional_id, dados.procedimento_id, dados.local_id, dados.data_desejada, dados.observacoes, agora],
        );
        await auditar(tx, {
          usuario: operador(req),
          acao: 'INSCRICAO_LISTA_ESPERA',
          entidade: 'lista_espera',
          entidade_id: id,
          detalhes: { cliente_id: dados.cliente_id, data_desejada: dados.data_desejada },
        });
      });

      res.status(201).json({ id, ...dados, status: 'aguardando', created_at: agora });
    }),
  );

  // Marca o pedido como atendido (encaixado na agenda) ou cancelado
  router.patch(
    '/lista-espera/:id/status',
    rota(async (req, res) => {
      const { status } = validar(statusListaEsperaSchema, req.body);
      const atual = await banco.um(`SELECT * FROM lista_espera WHERE id = ? AND clinica_id = ?`, [req.params.id, CLINICA_ID]);
      if (!atual) throw naoEncontrado('Pedido da lista de espera não encontrado.');

      await banco.transacao(async (tx) => {
        await tx.executar(`UPDATE lista_espera SET status = ? WHERE id = ?`, [status, atual.id]);
        await auditar(tx, {
          usuario: operador(req),
          acao: `LISTA_ESPERA_${status.toUpperCase()}`,
          entidade: 'lista_espera',
          entidade_id: atual.id,
          detalhes: { anterior: atual.status, novo: status },
        });
      });

      res.json({ ok: true, status });
    }),
  );

  return router;
}
