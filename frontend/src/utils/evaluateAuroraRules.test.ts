import { describe, expect, it } from 'vitest';
import { evaluateAuroraRules } from './evaluateAuroraRules';
import { AURORA_FIELD_IDS } from '../config/auroraFieldIds';
import { AURORA_FIELD_CATALOG } from '../config/formRules.aurora';

function buildBloque3Base(): Record<string, unknown> {
  return {
    [AURORA_FIELD_IDS.B3_DEFENSOR_ASIGNADO]: 'Defensor prueba',
    [AURORA_FIELD_IDS.B3_FECHA_ANALISIS]: '2026-01-10',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: 'Sí procede solicitud de libertad condicional',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA]: 'No aplica',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA]: 'No cumple por tipo de delito',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA]: 'No',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'Si',
    [AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION]: 'Ninguna',
    [AURORA_FIELD_IDS.B3_RESUMEN_ANALISIS]: 'Resumen del caso',
  };
}

function buildBloque4Base(): Record<string, unknown> {
  return {
    [AURORA_FIELD_CATALOG.q38]: '2026-01-11',
    [AURORA_FIELD_CATALOG.q39]: 'Si, desea que el defensor avance con la solicitud',
    [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
  };
}

describe('evaluateAuroraRules - reglas Aurora', () => {
  it('AURORA.B4.VISIBILIDAD.2 - muestra bloque 4 cuando 28-37 estan completos y hay al menos un "Si" entre 30-34', () => {
    const answers = {
      ...buildBloque3Base(),
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque3');
    expect(result.visibleBlocks).toContain('bloque4');
  });

  it('AURORA.B4.VISIBILIDAD.2 - permite bloque 4 con Q32 vacia si el resto obligatorio de bloque 3 esta completo', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA]: '',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'Si',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque3');
    expect(result.visibleBlocks).toContain('bloque4');
  });

  it('AURORA.B4.VISIBILIDAD.2 - reconoce "SÃ­" mojibake entre Q30-Q34 para habilitar bloque 4', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA]: '',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA]: 'No',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'SÃ­',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque3');
    expect(result.visibleBlocks).toContain('bloque4');
  });

  it('AURORA.B4.VISIBILIDAD.2 - no muestra bloque 4 cuando 30-34 no tienen ningun "Si"', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA]: 'No cumple por tipo de delito',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA]: 'No',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'No',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque3');
    expect(result.visibleBlocks).not.toContain('bloque4');
  });

  it('AURORA.B5A.DEPENDENCIA.3 - deshabilita motivo y recurso cuando Q52 != "Niega utilidad publica"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Utilidad publica (solo para mujeres)',
      [AURORA_FIELD_CATALOG.q52]: 'Otorga utilidad publica',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.disabledFields).toEqual(
      expect.arrayContaining([
        AURORA_FIELD_CATALOG.q53,
        AURORA_FIELD_CATALOG.q54,
        AURORA_FIELD_CATALOG.q55,
        AURORA_FIELD_CATALOG.q56,
      ])
    );
  });

  it('AURORA.B5A.DEPENDENCIA.4 - habilita campos de recurso cuando Q52 = "Niega utilidad publica" y Q54 = "Si"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Utilidad publica (solo para mujeres)',
      [AURORA_FIELD_CATALOG.q52]: 'Niega utilidad publica',
      [AURORA_FIELD_CATALOG.q54]: 'Si',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.disabledFields).not.toEqual(
      expect.arrayContaining([
        AURORA_FIELD_CATALOG.q53,
        AURORA_FIELD_CATALOG.q54,
        AURORA_FIELD_CATALOG.q55,
        AURORA_FIELD_CATALOG.q56,
      ])
    );
  });

  it('AURORA.B5B.DEPENDENCIA.4 - deshabilita motivo y recurso cuando Q47 != "No concede subrogado penal"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'Concede subrogado penal',
      [AURORA_FIELD_CATALOG.q54]: 'Si',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.disabledFields).toEqual(
      expect.arrayContaining([
        AURORA_FIELD_CATALOG.q53,
        AURORA_FIELD_CATALOG.q54,
        AURORA_FIELD_CATALOG.q55,
        AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud,
      ])
    );
  });

  it('AURORA.B5B.DEPENDENCIA.2 - habilita campos de recurso cuando Q47 = "No concede subrogado penal" y Q49 = "Si"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede subrogado penal',
      [AURORA_FIELD_CATALOG.q54]: 'Si',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.disabledFields).not.toEqual(
      expect.arrayContaining([
        AURORA_FIELD_CATALOG.q53,
        AURORA_FIELD_CATALOG.q54,
        AURORA_FIELD_CATALOG.q55,
        AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud,
      ])
    );
  });
});
