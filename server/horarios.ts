/**
 * Regras de horário da agenda, sem acesso ao banco (fáceis de testar).
 * Horários são tratados em minutos desde a meia-noite.
 */

export interface HorarioFuncionamento {
  abertura: string;
  fechamento: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
  /** 0 = domingo ... 6 = sábado */
  dias: number[];
}

export interface Faixa {
  inicio: number;
  fim: number;
}

export const MINUTOS_NO_DIA = 24 * 60;
export const PASSO_DA_GRADE_MIN = 30;

export function paraMinutos(hhmm: string): number {
  const [horas, minutos] = hhmm.split(':').map(Number);
  return horas * 60 + minutos;
}

export function paraHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [ano, mes, dia] = texto.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

export function horaValida(texto: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(texto)) return false;
  const [h, m] = texto.split(':').map(Number);
  return h <= 23 && m <= 59;
}

export function diaDaSemana(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia).getDay();
}

/** "2026-11-26T14:30:00" -> { data: "2026-11-26", hora: "14:30" } */
export function separarDataHora(iso: string) {
  return { data: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

export function montarDataHora(data: string, minutos: number): string {
  return `${data}T${paraHora(minutos)}:00`;
}

export function seSobrepoem(a: Faixa, b: Faixa): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

/**
 * Verifica se um atendimento cabe no expediente do local.
 * Devolve a mensagem do problema ou null quando está tudo certo.
 */
export function validarExpediente(horario: HorarioFuncionamento, data: string, faixa: Faixa): string | null {
  if (!horario.dias.includes(diaDaSemana(data))) {
    return 'Unidade fechada neste dia da semana.';
  }
  if (faixa.fim > MINUTOS_NO_DIA) {
    return 'O atendimento ultrapassa o fim do dia.';
  }
  if (faixa.inicio < paraMinutos(horario.abertura) || faixa.fim > paraMinutos(horario.fechamento)) {
    return `Horário fora do expediente do local (${horario.abertura}–${horario.fechamento}).`;
  }
  if (horario.intervalo_inicio && horario.intervalo_fim) {
    const intervalo = { inicio: paraMinutos(horario.intervalo_inicio), fim: paraMinutos(horario.intervalo_fim) };
    if (seSobrepoem(faixa, intervalo)) {
      return `Conflito com o intervalo da unidade (${horario.intervalo_inicio}–${horario.intervalo_fim}).`;
    }
  }
  return null;
}

/**
 * Lista os horários livres de um dia: de 30 em 30 minutos, dentro do expediente,
 * fora do intervalo e sem sobrepor nenhuma faixa já ocupada.
 */
export function calcularHorariosLivres(
  horario: HorarioFuncionamento,
  data: string,
  duracaoMin: number,
  ocupadas: Faixa[],
): Faixa[] {
  if (!horario.dias.includes(diaDaSemana(data))) return [];

  const livres: Faixa[] = [];
  const fechamento = paraMinutos(horario.fechamento);
  for (let inicio = paraMinutos(horario.abertura); inicio + duracaoMin <= fechamento; inicio += PASSO_DA_GRADE_MIN) {
    const faixa = { inicio, fim: inicio + duracaoMin };
    if (validarExpediente(horario, data, faixa)) continue;
    if (ocupadas.some((ocupada) => seSobrepoem(faixa, ocupada))) continue;
    livres.push(faixa);
  }
  return livres;
}
