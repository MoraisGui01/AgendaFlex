import type { Banco, Linha } from './banco/conexao.ts';
import { CLINICA_ID } from './config.ts';
import { conflito, naoEncontrado, requisicaoInvalida } from './http.ts';
import { type Faixa, type HorarioFuncionamento, paraMinutos, separarDataHora, validarExpediente } from './horarios.ts';

/**
 * Regras de agenda que dependem do banco: busca de cadastros ativos e
 * detecção de choque entre atendimentos do mesmo profissional ou do mesmo local.
 */

export interface Recursos {
  cliente: Linha;
  profissional: Linha;
  local: Linha & { horario: HorarioFuncionamento };
  procedimento: Linha;
}

async function ativo(banco: Banco, tabela: string, id: string, mensagem: string): Promise<Linha> {
  const linha = await banco.um(
    `SELECT * FROM ${tabela} WHERE id = ? AND clinica_id = ? AND deleted_at IS NULL AND status = 'ativo'`,
    [id, CLINICA_ID],
  );
  if (!linha) throw naoEncontrado(mensagem);
  return linha;
}

export function procedimentosDoProfissional(profissional: Linha): string[] {
  return JSON.parse(String(profissional.procedimentos_vinculados || '[]'));
}

/** Profissional sem vínculos cadastrados atende qualquer procedimento. */
export function profissionalAtende(profissional: Linha, procedimentoId: string): boolean {
  const vinculados = procedimentosDoProfissional(profissional);
  return vinculados.length === 0 || vinculados.includes(procedimentoId);
}

export async function carregarRecursos(
  banco: Banco,
  ids: { cliente_id?: string; profissional_id: string; local_id: string; procedimento_id: string },
): Promise<Recursos> {
  const cliente = ids.cliente_id ? await ativo(banco, 'clientes', ids.cliente_id, 'Cliente não encontrado ou inativo.') : {};
  const profissional = await ativo(banco, 'profissionais', ids.profissional_id, 'Profissional não encontrado ou inativo.');
  const procedimento = await ativo(banco, 'procedimentos', ids.procedimento_id, 'Procedimento não encontrado ou inativo.');
  const local = await ativo(banco, 'locais', ids.local_id, 'Local não encontrado ou inativo.');

  if (!profissionalAtende(profissional, ids.procedimento_id)) {
    throw requisicaoInvalida('Este procedimento não está vinculado ao profissional selecionado.');
  }

  return {
    cliente,
    profissional,
    procedimento: { ...procedimento, duracao_min: Number(procedimento.duracao_min), valor: Number(procedimento.valor) },
    local: { ...local, horario: JSON.parse(String(local.horario_func)) },
  };
}

/** Faixas já ocupadas no dia pelo profissional ou pelo local (cancelados não contam). */
export async function faixasOcupadas(
  banco: Banco,
  data: string,
  profissionalId: string,
  localId: string,
  ignorarId?: string,
): Promise<Faixa[]> {
  const linhas = await banco.todos<{ data_hora_inicio: string; data_hora_fim: string }>(
    `SELECT data_hora_inicio, data_hora_fim FROM agendamentos
     WHERE deleted_at IS NULL AND status != 'cancelado'
       AND substr(data_hora_inicio, 1, 10) = ?
       AND (profissional_id = ? OR local_id = ?)
       AND id != ?`,
    [data, profissionalId, localId, ignorarId ?? ''],
  );
  return linhas.map((l) => ({
    inicio: paraMinutos(separarDataHora(l.data_hora_inicio).hora),
    fim: paraMinutos(separarDataHora(l.data_hora_fim).hora),
  }));
}

/** Lança 409 se o intervalo [inicio, fim) chocar com outro atendimento do profissional ou do local. */
export async function garantirSemChoque(
  banco: Banco,
  dados: { profissional_id: string; local_id: string; inicio: string; fim: string; ignorarId?: string },
  mensagemExtra = '',
): Promise<void> {
  const choque = await banco.um<{ profissional_id: string }>(
    `SELECT profissional_id FROM agendamentos
     WHERE deleted_at IS NULL AND status != 'cancelado'
       AND (profissional_id = ? OR local_id = ?)
       AND data_hora_inicio < ? AND data_hora_fim > ?
       AND id != ?`,
    [dados.profissional_id, dados.local_id, dados.fim, dados.inicio, dados.ignorarId ?? ''],
  );
  if (choque) {
    const motivo =
      mensagemExtra ||
      (choque.profissional_id === dados.profissional_id
        ? 'O profissional já tem atendimento neste horário.'
        : 'O local já está reservado neste horário.');
    throw conflito(`Horário indisponível. ${motivo}`);
  }
}

/** Valida o expediente do local e lança 409 com o motivo, se houver. */
export function garantirExpediente(horario: HorarioFuncionamento, data: string, faixa: Faixa): void {
  const problema = validarExpediente(horario, data, faixa);
  if (problema) throw conflito(`Horário indisponível. ${problema}`);
}

/** "2026-11-26" -> "26/11/2026" */
export function dataBr(data: string): string {
  return data.split('-').reverse().join('/');
}
