import { describe, expect, it } from 'vitest';
import { evaluateCelesteRules } from './evaluateCelesteRules';
import { mandatoryByBlock } from '../config/formRules.celeste';

function buildBloque3Completo(): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  (mandatoryByBlock.bloque3Celeste || [])
    .filter((field) => !field.optional)
    .forEach((field) => {
      answers[field.key] = 'ok';
    });
  return answers;
}

describe('evaluateCelesteRules - reglas Celeste', () => {
  it('CELESTE.B4.VISIBILIDAD.1 - muestra bloque 4 cuando bloque 3 esta completo', () => {
    const answers = {
      ...buildBloque3Completo(),
    };

    const result = evaluateCelesteRules({ answers });
    expect(result.visibleBlocks).toContain('bloque4Celeste');
  });

  it('CELESTE.B5.VISIBILIDAD.2 - no muestra bloque 5 mientras falte fecha de bloque 4', () => {
    const answers = {
      ...buildBloque3Completo(),
      'Fecha de entrevista': '',
    };

    const result = evaluateCelesteRules({ answers });
    expect(result.visibleBlocks).toContain('bloque4Celeste');
    expect(result.visibleBlocks).not.toContain('bloque5Celeste');
  });

  it('CELESTE.B5.VISIBILIDAD.2 - muestra bloque 5 cuando bloque 4 esta completo', () => {
    const answers = {
      ...buildBloque3Completo(),
      'Fecha de entrevista': '2026-01-10',
    };

    const result = evaluateCelesteRules({ answers });
    expect(result.visibleBlocks).toContain('bloque5Celeste');
  });
});
