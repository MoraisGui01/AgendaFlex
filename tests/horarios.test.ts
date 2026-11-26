import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcularHorariosLivres, dataValida, paraHora, paraMinutos, seSobrepoem, validarExpediente } from '../server/horarios.ts';

const expediente = {
  abertura: '08:00',
  fechamento: '12:00',
  intervalo_inicio: '10:00',
  intervalo_fim: '10:30',
  dias: [1, 2, 3, 4, 5],
};
const QUINTA = '2026-11-26';
const DOMINGO = '2026-11-29';

describe('horários', () => {
  it('converte entre HH:MM e minutos', () => {
    assert.equal(paraMinutos('08:30'), 510);
    assert.equal(paraHora(510), '08:30');
  });

  it('valida datas reais do calendário', () => {
    assert.ok(dataValida('2024-02-29'));
    assert.ok(!dataValida('2026-02-29'));
    assert.ok(!dataValida('26/11/2026'));
  });

  it('detecta sobreposição sem considerar horários encostados', () => {
    assert.ok(seSobrepoem({ inicio: 60, fim: 120 }, { inicio: 90, fim: 150 }));
    assert.ok(!seSobrepoem({ inicio: 60, fim: 120 }, { inicio: 120, fim: 180 }));
  });

  it('recusa dia fechado, horário fora do expediente e intervalo', () => {
    assert.match(validarExpediente(expediente, DOMINGO, { inicio: 480, fim: 510 })!, /fechada/);
    assert.match(validarExpediente(expediente, QUINTA, { inicio: 690, fim: 750 })!, /fora do expediente/);
    assert.match(validarExpediente(expediente, QUINTA, { inicio: 585, fim: 615 })!, /intervalo/);
    assert.equal(validarExpediente(expediente, QUINTA, { inicio: 480, fim: 510 }), null);
  });

  it('lista horários livres respeitando intervalo e ocupados', () => {
    const ocupadas = [{ inicio: paraMinutos('08:30'), fim: paraMinutos('09:00') }];
    const livres = calcularHorariosLivres(expediente, QUINTA, 30, ocupadas).map((f) => paraHora(f.inicio));
    assert.deepEqual(livres, ['08:00', '09:00', '09:30', '10:30', '11:00', '11:30']);
  });

  it('não oferece horários em dia fechado', () => {
    assert.deepEqual(calcularHorariosLivres(expediente, DOMINGO, 30, []), []);
  });
});
