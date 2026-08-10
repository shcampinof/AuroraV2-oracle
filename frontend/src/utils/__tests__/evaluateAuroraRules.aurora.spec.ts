import { describe, expect, it } from 'vitest';
import { evaluateAuroraRules } from '../evaluateAuroraRules';
import { AURORA_FIELD_IDS } from '../../config/auroraFieldIds';

describe('AURORA - visibilidad bloque 4', () => {
  it('AURORA.B4.VISIBILIDAD.2 - requiere al menos un "Si" entre Q30-Q34', () => {
    const answers: Record<string, unknown> = {
      [AURORA_FIELD_IDS.B3_DEFENSOR_ASIGNADO]: 'Defensor prueba',
      [AURORA_FIELD_IDS.B3_FECHA_ANALISIS]: '2026-01-10',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA]: 'No cumple por tipo de delito',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA]: 'No',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'Si',
      [AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION]: 'Ninguna',
      [AURORA_FIELD_IDS.B3_RESUMEN_ANALISIS]: 'Resumen del caso',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque4');
  });
});
