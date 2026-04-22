import { describe, expect, it } from 'vitest';
import { evaluateCelesteRules, normalize } from './evaluateCelesteRules';
import { mandatoryByBlock } from '../config/formRules.celeste';

const BLOQUE_3_FIELDS = mandatoryByBlock.bloque3Celeste || [];
const Q21 = BLOQUE_3_FIELDS.find((field) => field.label.startsWith('21 '))?.key || 'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS';
const Q23 = mandatoryByBlock.bloque4Celeste?.[0]?.key || 'Fecha de entrevista';
const Q24 = 'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA';
const Q25 = 'FECHA DE REALIZACIÓN DE AUDIENCIA';
const Q26 = 'SENTIDO DE LA DECISIÓN';
const Q28 = '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?';
const Q29 = 'Fecha de presentación del recurso';
const Q30 = 'Fecha de la decisión del recurso';
const Q31 = 'SENTIDO DE LA DECISIÓN QUE RESUELVE RECURSO';

const Q21_SE_AVANZA = 'Se avanzará';
const Q21_NO_AVANZA = 'No se avanzará';
const Q26_REVOCA = 'revoca medida';
const Q26_SUSTITUYE = 'sustituye medida';
const Q26_NIEGA = 'niega la solicitud';

function buildBloque3Completo(): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  (mandatoryByBlock.bloque3Celeste || [])
    .filter((field) => !field.optional)
    .forEach((field) => {
      answers[field.key] = 'ok';
    });
  return answers;
}

function buildBaseSeAvanza(): Record<string, unknown> {
  return {
    ...buildBloque3Completo(),
    [Q21]: Q21_SE_AVANZA,
  };
}

describe('evaluateCelesteRules - flujo sindicados', () => {
  it('Regla 1: si faltan preguntas 19 a 22, estado = Analizar el caso', () => {
    const result = evaluateCelesteRules({ answers: {} });
    expect(result.derivedStatus).toBe('Analizar el caso');
  });

  it('Regla 2: si Q21 inicia con "No se avanzará...", estado = Caso cerrado y lock activo', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBloque3Completo(),
        [Q21]: Q21_NO_AVANZA,
      },
    });

    expect(result.derivedStatus).toBe('Caso cerrado');
    expect(result.locked).toBe(true);
    expect(result.visibleBlocks).toEqual(['bloque1', 'bloque2Celeste', 'bloque3Celeste']);
  });

  it('Regla 3: con Q21 = "Se avanzará..." y sin Q23, estado = Entrevistar al usuario', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
      },
    });
    expect(result.derivedStatus).toBe('Entrevistar al usuario');
  });

  it('Regla 4: si Q23 está diligenciada, estado = Presentar solicitud', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
      },
    });
    expect(result.derivedStatus).toBe('Presentar solicitud');
  });

  it('Regla nueva: si Q24 está diligenciada y Q25 no, estado = Pendiente audiencia', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
        [Q24]: '2026-04-16',
      },
    });
    expect(result.derivedStatus).toBe('Pendiente audiencia');
  });

  it('Regla nueva: si Q25 está diligenciada y Q26 no, estado = Pendiente decisión de audiencia', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
        [Q25]: '2026-04-18',
      },
    });
    expect(result.derivedStatus).toBe('Pendiente decisión de audiencia');
  });

  it('Regla 5: con Q24/Q25 diligenciadas y Q26 = revoca, estado = Caso cerrado', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
        [Q24]: '2026-04-16',
        [Q25]: '2026-04-18',
        [Q26]: Q26_REVOCA,
      },
    });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('Regla 5 (variante): con Q24/Q25 diligenciadas y Q26 = sustituye, estado = Caso cerrado', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
        [Q24]: '2026-04-16',
        [Q25]: '2026-04-18',
        [Q26]: Q26_SUSTITUYE,
      },
    });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('Regla 6: con Q24/Q25 diligenciadas y Q26 = niega, estado = Presentar recurso', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
        [Q24]: '2026-04-16',
        [Q25]: '2026-04-18',
        [Q26]: Q26_NIEGA,
      },
    });
    expect(result.derivedStatus).toBe('Presentar recurso');
  });

  it('Regla 7: si Q28 = No, estado = Caso cerrado', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
        [Q24]: '2026-04-16',
        [Q25]: '2026-04-18',
        [Q26]: Q26_NIEGA,
        [Q28]: 'no',
      },
    });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('Regla 8: si Q28 = Sí, se mantiene estado = Presentar recurso', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
        [Q24]: '2026-04-16',
        [Q25]: '2026-04-18',
        [Q26]: Q26_NIEGA,
        [Q28]: 'si',
      },
    });
    expect(result.derivedStatus).toBe('Presentar recurso');
  });

  it('Regla 9: si Q29 tiene fecha de presentación de recurso, estado = Pendiente decisión', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
        [Q24]: '2026-04-16',
        [Q25]: '2026-04-18',
        [Q26]: Q26_NIEGA,
        [Q28]: 'si',
        [Q29]: '2026-04-19',
      },
    });
    expect(normalize(result.derivedStatus)).toBe('pendiente decision');
  });

  it('Regla adicional: si Q30 (fecha de decisión del recurso) tiene respuesta, estado = Caso cerrado', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q30]: '2026-04-21',
      },
    });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('Regla adicional: si Q31 (sentido que resuelve recurso) tiene respuesta, estado = Caso cerrado', () => {
    const result = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q31]: 'Concede levantamiento de medida de aseguramiento',
      },
    });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('Visibilidad: con bloque 3 completo muestra bloque 4; con Q23 diligenciada muestra bloque 5', () => {
    const b4 = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
      },
    });
    expect(b4.visibleBlocks).toContain('bloque4Celeste');
    expect(b4.visibleBlocks).not.toContain('bloque5Celeste');

    const b5 = evaluateCelesteRules({
      answers: {
        ...buildBaseSeAvanza(),
        [Q23]: '2026-04-15',
      },
    });
    expect(b5.visibleBlocks).toContain('bloque5Celeste');
  });
});


