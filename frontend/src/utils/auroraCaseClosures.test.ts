import { describe, expect, it } from 'vitest';
import { getMotivoCierreBloque3Aurora, isCierreBloque3Aurora } from '../config/formRules.aurora';
import { evaluateAuroraRules } from './evaluateAuroraRules';
import closures from '../../../shared/aurora-case-closures.json';
import { AURORA_FIELD_IDS } from '../config/auroraFieldIds';

const transfer = {
  'Procedencia de libertad condicional': closures.traslado.respuesta,
  'Procedencia de prisión domiciliaria de mitad de pena': closures.traslado.respuesta,
  'Procedencia de utilidad pública (solo para mujeres)': 'No cumple requisitos objetivos',
  'Procedencia de pena cumplida': 'No',
  'Procedencia de acumulación de penas': 'No',
  'Otras solicitudes a tramitar': 'Ninguna',
};

describe('motivos de cierre del bloque 3', () => {
  it.each(['Procedencia de libertad condicional', 'Procedencia de prisión domiciliaria de mitad de pena'])
  ('cierra por libertad en %s aunque haya procedencias positivas y recurso pendiente', (field) => {
    const answers = { [field]: `4. ${closures.libertad.respuesta}`,
      'Procedencia de utilidad pública (solo para mujeres)': 'Sí cumple requisitos objetivos',
      'Sentido de la decisión': 'No concede la solicitud', 'Se presenta recurso': 'Sí' };
    expect(getMotivoCierreBloque3Aurora(answers)).toBe(closures.libertad.motivo);
    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
    expect(result.visibleBlocks).not.toContain('bloque4');
    expect(result.visibleBlocks).not.toContain('bloque5TramiteNormal');
  });

  it('reconoce la opción de libertad mediante el ID estable', () => {
    expect(isCierreBloque3Aurora({ [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: closures.libertad.respuesta })).toBe(true);
  });

  it('distingue el traslado informado de un cierre genérico sin procedencias', () => {
    expect(getMotivoCierreBloque3Aurora(transfer)).toBe(closures.traslado.motivo);
  });

  it.each([
    ['Procedencia de utilidad pública (solo para mujeres)', 'Sí cumple requisitos objetivos'],
    ['Procedencia de pena cumplida', 'Sí'],
    ['Procedencia de acumulación de penas', 'Sí'],
    ['Otras solicitudes a tramitar', 'Redención de pena'],
    ['Procedencia de pena cumplida', ''],
    ['Otras solicitudes a tramitar', ''],
    ['Procedencia de prisión domiciliaria de mitad de pena', 'No aplica'],
  ])('no da por confirmado el cierre por traslado con %s = %s', (field, value) => {
    expect(getMotivoCierreBloque3Aurora({ ...transfer, [field]: value })).toBe('');
  });
});
