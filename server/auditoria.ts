import crypto from 'node:crypto';
import type { Banco } from './banco/conexao.ts';
import { CLINICA_ID } from './config.ts';

export interface RegistroAuditoria {
  usuario: string;
  acao: string;
  entidade: string;
  entidade_id: string;
  detalhes?: Record<string, unknown>;
}

/** Grava quem fez o quê e quando (rastreabilidade exigida pela LGPD). */
export async function auditar(banco: Banco, registro: RegistroAuditoria): Promise<void> {
  await banco.executar(
    `INSERT INTO logs_auditoria (id, clinica_id, usuario, acao, entidade, entidade_id, detalhes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      CLINICA_ID,
      registro.usuario || 'Sistema',
      registro.acao,
      registro.entidade,
      registro.entidade_id,
      JSON.stringify(registro.detalhes ?? {}),
      new Date().toISOString(),
    ],
  );
}
