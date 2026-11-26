import crypto from 'node:crypto';
import { Router } from 'express';
import { dataBr, garantirSemChoque } from '../agenda.ts';
import { operador } from '../auth.ts';
import { auditar } from '../auditoria.ts';
import type { Banco } from '../banco/conexao.ts';
import { naoEncontrado, rota, validar } from '../http.ts';
import { separarDataHora } from '../horarios.ts';
import { estadoWhatsappSchema } from '../validacao.ts';

/**
 * Simulação da integração com o WhatsApp.
 * Em produção, o webhook do provedor (ver supabase/functions/whatsapp-webhook) faria esta mesma transição
 * quando o cliente responde "1" (confirmar) ou "2" (cancelar).
 */
export function rotasWhatsapp(banco: Banco): Router {
  const router = Router();

  router.get(
    '/whatsapp/mensagens',
    rota(async (_req, res) => {
      const mensagens = await banco.todos(
        `SELECT wm.*, c.nome AS cliente_nome
         FROM whatsapp_mensagens wm
         JOIN agendamentos a ON a.id = wm.agendamento_id
         JOIN clientes c ON c.id = a.cliente_id
         ORDER BY wm.created_at DESC
         LIMIT 30`,
      );
      res.json(mensagens);
    }),
  );

  router.post(
    '/whatsapp/simular',
    rota(async (req, res) => {
      const { agendamento_id, novo_estado } = validar(estadoWhatsappSchema, req.body);

      const resultado = await banco.transacao(async (tx) => {
        const ag = await tx.um(
          `SELECT a.*, c.nome AS cliente_nome, c.whatsapp AS cliente_whatsapp, p.nome AS procedimento_nome
           FROM agendamentos a
           JOIN clientes c ON c.id = a.cliente_id
           JOIN procedimentos p ON p.id = a.procedimento_id
           WHERE a.id = ? AND a.deleted_at IS NULL`,
          [agendamento_id],
        );
        if (!ag) throw naoEncontrado('Agendamento não encontrado.');

        // Cancelar pelo WhatsApp libera o horário; responder de novo num cancelado tenta reativar
        let novoStatus = ag.status;
        if (novo_estado === 'Cancelado') novoStatus = 'cancelado';
        else if (ag.status === 'cancelado') novoStatus = 'agendado';

        if (ag.status === 'cancelado' && novoStatus === 'agendado') {
          await garantirSemChoque(
            tx,
            { profissional_id: ag.profissional_id, local_id: ag.local_id, inicio: ag.data_hora_inicio, fim: ag.data_hora_fim, ignorarId: ag.id },
            'O horário já foi ocupado por outro cliente.',
          );
        }

        await tx.executar(`UPDATE agendamentos SET whatsapp_status = ?, status = ? WHERE id = ?`, [novo_estado, novoStatus, ag.id]);

        const { data, hora } = separarDataHora(ag.data_hora_inicio);
        const conteudo = {
          Confirmado: `✅ Presença confirmada para ${ag.procedimento_nome} em ${dataBr(data)} às ${hora}.`,
          Cancelado: '❌ Agendamento cancelado pelo cliente. O horário foi liberado na agenda.',
          'Aguardando Confirmação': `🔔 Lembrete: confirme seu horário de ${ag.procedimento_nome} em ${dataBr(data)} às ${hora}.`,
        }[novo_estado];

        await tx.executar(
          `INSERT INTO whatsapp_mensagens (id, agendamento_id, telefone, estado, conteudo, direcao, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(), ag.id, ag.cliente_whatsapp, novo_estado, conteudo,
            novo_estado === 'Aguardando Confirmação' ? 'enviada' : 'recebida',
            new Date().toISOString(),
          ],
        );

        await auditar(tx, {
          usuario: `WhatsApp (${operador(req)})`,
          acao: `WHATSAPP_${novo_estado.toUpperCase().replace(/\s+/g, '_')}`,
          entidade: 'agendamentos',
          entidade_id: ag.id,
          detalhes: { cliente: ag.cliente_nome, novo_estado },
        });

        return { ok: true, agendamento_id: ag.id, whatsapp_status: novo_estado, status: novoStatus };
      });

      res.json(resultado);
    }),
  );

  return router;
}
