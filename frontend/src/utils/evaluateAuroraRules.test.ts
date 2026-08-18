import { describe, expect, it } from 'vitest';
import { evaluateAuroraRules } from './evaluateAuroraRules';
import { AURORA_FIELD_IDS } from '../config/auroraFieldIds';
import { AURORA_FIELD_CATALOG } from '../config/formRules.aurora';

function buildBloque3Base(): Record<string, unknown> {
  return {
    [AURORA_FIELD_IDS.B3_DEFENSOR_ASIGNADO]: 'Defensor prueba',
    [AURORA_FIELD_IDS.B3_FECHA_ANALISIS]: '2026-01-10',
    'Fecha de análisis jurídico del caso': '2026-01-10',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: 'Sí procede solicitud de libertad condicional',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA]: 'No aplica',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA]: 'No cumple por tipo de delito',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA]: 'No',
    [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'Si',
    [AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION]: 'Ninguna',
    [AURORA_FIELD_IDS.B3_RESUMEN_ANALISIS]: 'Resumen del caso',
    [AURORA_FIELD_CATALOG.q37]: 'Resumen del caso',
  };
}

function buildBloque4Base(): Record<string, unknown> {
  return {
    [AURORA_FIELD_CATALOG.q38]: '2026-01-11',
    [AURORA_FIELD_CATALOG.q39]: 'Si, desea que el defensor avance con la solicitud',
    [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
    'Requiere pruebas': 'No',
    'Poder en caso de avanzar con la solicitud': 'No requiere poder',
  };
}

function buildNegativeClosureBase(): Record<string, unknown> {
  return {
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'Defensor prueba',
    'Fecha de análisis jurídico del caso': '2026-07-29',
    [AURORA_FIELD_CATALOG.q30]: 'No aplica',
    [AURORA_FIELD_CATALOG.q31]: 'No aplica',
    [AURORA_FIELD_CATALOG.q32]: '',
    [AURORA_FIELD_CATALOG.q33]: 'No',
    [AURORA_FIELD_CATALOG.q34]: 'No',
    [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
    [AURORA_FIELD_CATALOG.q37]: 'Resumen del análisis',
  };
}

describe('evaluateAuroraRules - reglas Aurora', () => {
  it.each(['-', '--'])('AURORA.ESTADO.DECISION_PLACEHOLDER.1 - %s en Q39 no cierra el caso', (placeholder) => {
    const result = evaluateAuroraRules({
      answers: {
        ...buildBloque3Base(),
        [AURORA_FIELD_CATALOG.q39]: placeholder,
      },
    });

    expect(result.derivedStatus).toBe('Entrevistar al usuario');
    expect(result.locked).toBe(false);
  });

  it('AURORA.ESTADO.DECISION_NEGATIVA.1 - una decisión negativa real en Q39 conserva el cierre', () => {
    const result = evaluateAuroraRules({
      answers: {
        ...buildBloque3Base(),
        [AURORA_FIELD_CATALOG.q39]: 'No desea tramitar la solicitud',
      },
    });

    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.CATALOGO.TUTELA.1 - Acción de tutela en Q36 permite continuar al bloque 4', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'No',
      [AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION]: 'Acción de tutela',
      [AURORA_FIELD_CATALOG.q36]: 'Acción de tutela',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque4');
    expect(result.derivedStatus).toBe('Entrevistar al usuario');
  });

  it('AURORA.CATALOGO.TUTELA.2 - Acción de tutela en Q40 usa el trámite normal', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Acción de tutela',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque5TramiteNormal');
    expect(result.visibleBlocks).not.toContain('bloque5UtilidadPublica');
    expect(result.derivedStatus).toBe('Presentar solicitud');
  });

  it('AURORA.B5B.INSISTENCIAS.1 - las fechas de insistencia no alteran el flujo ni el estado', () => {
    const fechasInsistencia = {
      [AURORA_FIELD_CATALOG.b5NormalNumeroInsistencias]: '5',
      [AURORA_FIELD_CATALOG.b5NormalFechaInsistencia1]: '2026-08-01',
      [AURORA_FIELD_CATALOG.b5NormalFechaInsistencia2]: '2026-08-08',
      [AURORA_FIELD_CATALOG.b5NormalFechaInsistencia3]: '2026-08-15',
      [AURORA_FIELD_CATALOG.b5NormalFechaInsistencia4]: '2026-08-22',
      [AURORA_FIELD_CATALOG.b5NormalFechaInsistencia5]: '2026-08-29',
    };

    expect(evaluateAuroraRules({ answers: fechasInsistencia })).toEqual(
      evaluateAuroraRules({ answers: {} })
    );

    const tramiteNormal = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.b5NormalRadicacion]: '2026-07-20',
    };
    expect(evaluateAuroraRules({ answers: { ...tramiteNormal, ...fechasInsistencia } })).toEqual(
      evaluateAuroraRules({ answers: tramiteNormal })
    );
  });

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

  it('AURORA.B4.VISIBILIDAD.2 - reconoce "Sí" mojibake entre Q30-Q34 para habilitar bloque 4', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA]: '',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA]: 'No',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'Sí',
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

  it('AURORA.B4.VISIBILIDAD.2 - muestra bloque 4 si Q36 tiene solicitud positiva, aun cuando Q30-Q34 no tengan "Si"', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA]: 'No aplica',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_UTILIDAD_PUBLICA]: 'No cumple por tipo de delito',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PENA_CUMPLIDA]: 'No',
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_ACUMULACION_PENAS]: 'No',
      [AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION]: 'Solicitud de actualizacion de conducta',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque3');
    expect(result.visibleBlocks).toContain('bloque4');
  });

  it('AURORA.B4.VISIBILIDAD.2 - no muestra bloque 4 cuando Q36 solo contiene la marca automatica de multiples opciones', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION]: 'MAS DE UNA OPCION (VER RESUMEN ANALISIS DEL CASO)',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque3');
    expect(result.visibleBlocks).not.toContain('bloque4');
  });

  it('AURORA.B4.VISIBILIDAD.2 - reconoce opcion intermedia "Si procedera proximamente" como afirmativa', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_LIBERTAD_CONDICIONAL]:
        'Sí procederá proximamente libertad condicional (>57% de pena cumplida)',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque4');
  });

  it('AURORA.B4.VISIBILIDAD.2 - reconoce opcion intermedia "90 días o menos" como afirmativa', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_IDS.B3_PROCEDENCIA_PRISION_DOMICILIARIA]:
        'Sí procederá proximamente prisión domiciliaria (90 días o menos para cumplir tiempo)',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).toContain('bloque4');
  });

  it('AURORA.ESTADO.UTILIDAD.1 - en utilidad publica pasa a "Presentar solicitud" si 29/37/38/40 estan diligenciadas y falta radicacion (Q50)', () => {
    const answers = {
      ...buildBloque3Base(),
      'Fecha de análisis jurídico del caso': '2026-01-10',
      [AURORA_FIELD_CATALOG.q37]: 'Resumen del caso',
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Utilidad publica (solo para mujeres)',
      [AURORA_FIELD_CATALOG.q43]: '',
      [AURORA_FIELD_CATALOG.q44]: '',
      [AURORA_FIELD_CATALOG.q45]: '',
      [AURORA_FIELD_CATALOG.q46]: '',
      [AURORA_FIELD_CATALOG.q49]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Presentar solicitud');
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

  it('AURORA.B5B.DEPENDENCIA.4 - deshabilita motivo y recurso cuando Q49 != "No concede la solicitud"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'Concede la solicitud',
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

  it('AURORA.B5B.DEPENDENCIA.2 - habilita campos de recurso cuando Q49 = "No concede la solicitud" y Q51 = "Si"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
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

  it('AURORA.B5B.DEPENDENCIA.2 - mantiene compatibilidad con valor historico "No concede subrogado penal"', () => {
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

  it('AURORA.ESTADO.RADICACION_ALIAS.1 - pasa a "Pendiente decisión" cuando existe fecha de presentación con alias histórico', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      'Fecha de presentación de solicitud a la autoridad judicial': '2026-01-15',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.RADICACION_ALIAS.2 - reconoce alias sin "la" ni "judicial"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      'Fecha de presentación de solicitud a la autoridad': '2026-01-15',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.INICIAL.1 - con 29 y 37 diligenciadas, pero sin actuación viable, debe seguir en análisis', () => {
    const answers = {
      'Fecha de análisis jurídico del caso': '2026-01-10',
      [AURORA_FIELD_CATALOG.q37]: 'Resumen del caso',
      [AURORA_FIELD_CATALOG.q38]: '',
      [AURORA_FIELD_CATALOG.q40]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Analizar el caso');
  });

  it('AURORA.CIERRE.NO_PROCEDE_NADA.1 - cierra el caso cuando la actuación indica "NO PROCEDE NADA"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'NO PROCEDE NADA',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.CIERRE.REGLA1.1 - cierra el caso cuando Q30-Q34 son negativas y Q36 no tiene solicitud positiva', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q30]: 'No aplica',
      [AURORA_FIELD_CATALOG.q31]: 'No aplica',
      [AURORA_FIELD_CATALOG.q32]: 'No cumple por tipo de delito',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.CIERRE.REGLA1.2 - utilidad pública vacía no bloquea el cierre ni el cálculo de la acción', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q30]: 'No aplica',
      [AURORA_FIELD_CATALOG.q31]: 'No aplica',
      [AURORA_FIELD_CATALOG.q32]: '',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.CIERRE.REGLA1.3 - no cierra si Q36 no fue respondida explícitamente con Ninguna', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q30]: 'No aplica',
      [AURORA_FIELD_CATALOG.q31]: 'No aplica',
      [AURORA_FIELD_CATALOG.q32]: '',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: '',
      [AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION]: '',
    };

    expect(evaluateAuroraRules({ answers }).derivedStatus).not.toBe('Caso cerrado');
  });

  it('AURORA.CIERRE.REGLA1.4 - no cierra sin fecha de análisis aunque Q36 sea Ninguna', () => {
    const answers = {
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q30]: 'No aplica',
      [AURORA_FIELD_CATALOG.q31]: 'No aplica',
      [AURORA_FIELD_CATALOG.q32]: '',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
      [AURORA_FIELD_IDS.B3_FECHA_ANALISIS]: '',
      'Fecha de análisis jurídico del caso': '',
    };

    expect(evaluateAuroraRules({ answers }).derivedStatus).not.toBe('Caso cerrado');
  });

  it('AURORA.CIERRE.REGLA1.5 - cierra el caso de referencia 15534694', () => {
    const answers = {
      'Fecha de análisis jurídico del caso': '2026-07-29',
      [AURORA_FIELD_CATALOG.q30]: 'No aplica porque la condena está por delito excluido del subrogado',
      [AURORA_FIELD_CATALOG.q31]: 'No aplica porque la condena está por delito excluido del subrogado',
      [AURORA_FIELD_CATALOG.q32]: '',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
      [AURORA_FIELD_CATALOG.q37]: 'No procede subrogado de libertad condicional por delito contra menor de edad.',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
    expect(result.visibleBlocks).not.toContain('bloque4');
  });

  it.each([
    ['Libertad condicional', 'Concede la solicitud'],
    ['Utilidad pública', 'Otorga utilidad pública'],
  ])('AURORA.REGRESION.1022938443 - ignora datos ocultos de bloque 5 para %s', (actuacion, sentido) => {
    const answers = {
      'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'Defensor prueba',
      'Fecha de análisis jurídico del caso': '',
      [AURORA_FIELD_CATALOG.q30]: 'No aplica porque está en trámite solicitud de acumulación de penas',
      [AURORA_FIELD_CATALOG.q31]: 'No aplica porque está en trámite solicitud de acumulación de penas',
      [AURORA_FIELD_CATALOG.q32]: '',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: '',
      [AURORA_FIELD_CATALOG.q37]: 'Está pendiente solicitud de acumulación de penas',
      [AURORA_FIELD_CATALOG.q40]: actuacion,
      [AURORA_FIELD_CATALOG.q52]: sentido,
      [AURORA_FIELD_CATALOG.q56]: 'Dato histórico oculto',
      [AURORA_FIELD_CATALOG.fechaDecisionRecurso]: '2025-01-01',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Analizar el caso');
    expect(result.visibleBlocks).not.toContain('bloque4');
    expect(result.visibleBlocks).not.toContain('bloque5TramiteNormal');
    expect(result.visibleBlocks).not.toContain('bloque5UtilidadPublica');
  });

  it.each([
    'No aplica porque ya hay solicitud de libertad o subrogado penal en trámite',
    'No aplica porque la condena está por delito excluido del subrogado',
    'No aplica porque se determinó que no ha cumplido requisito temporal para acceder',
    '10. No aplica porque la condena está por delito excluido del subrogado',
  ])('AURORA.CIERRE.MATRIZ.NEGATIVAS - reconoce como negativa: %s', (respuestaNegativa) => {
    const answers = {
      ...buildNegativeClosureBase(),
      [AURORA_FIELD_CATALOG.q30]: respuestaNegativa,
      [AURORA_FIELD_CATALOG.q31]: respuestaNegativa,
      [AURORA_FIELD_CATALOG.q32]: 'No cumple por tipo de delito',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
    };

    expect(evaluateAuroraRules({ answers }).derivedStatus).toBe('Caso cerrado');
  });

  it.each([
    [AURORA_FIELD_CATALOG.q30, 'Sí procede solicitud de libertad condicional'],
    [AURORA_FIELD_CATALOG.q31, 'Sí procede solicitud de prisión domiciliaria de mitad de pena'],
    [AURORA_FIELD_CATALOG.q32, 'Sí cumple requisitos objetivos'],
    [AURORA_FIELD_CATALOG.q33, 'Sí'],
    [AURORA_FIELD_CATALOG.q34, 'Sí'],
  ])('AURORA.CIERRE.MATRIZ.POSITIVAS - %s positiva no cierra y habilita entrevista', (field, value) => {
    const answers = {
      ...buildNegativeClosureBase(),
      [AURORA_FIELD_CATALOG.q30]: 'No aplica',
      [AURORA_FIELD_CATALOG.q31]: 'No aplica',
      [AURORA_FIELD_CATALOG.q32]: '',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
      [field]: value,
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Entrevistar al usuario');
    expect(result.visibleBlocks).toContain('bloque4');
  });

  it.each([
    'Solicitud de actualización de conducta',
    'Solicitud de asignación de JEPMS',
    'Solicitud de traslado del proceso al distrito judicial correspondiente',
    'Solicitud de actualización de cartilla biográfica',
    'Solicitud de redención de pena 2x3 trabajo',
    'Solicitud de redención de pena 2x3 analógica en actividades distintas a trabajo',
    'Permiso de 72 horas',
    'Otra',
  ])('AURORA.CIERRE.MATRIZ.Q36 - %s no cierra y habilita entrevista', (solicitud) => {
    const answers = {
      ...buildNegativeClosureBase(),
      [AURORA_FIELD_CATALOG.q30]: 'No aplica',
      [AURORA_FIELD_CATALOG.q31]: 'No aplica',
      [AURORA_FIELD_CATALOG.q32]: '',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: solicitud,
      [AURORA_FIELD_IDS.B3_ANALISIS_ACTUACION]: solicitud,
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Entrevistar al usuario');
    expect(result.visibleBlocks).toContain('bloque4');
  });

  it.each([
    ['', 'No aplica'],
    ['Revisión suspendida porque se requiere primero trámite de acumulación de penas', 'No aplica'],
    ['No aplica', 'Revisión suspendida porque se requiere primero trámite de acumulación de penas'],
  ])('AURORA.ESTADO.MATRIZ.PENDIENTE - no envía a entrevista con Q30=%s y Q31=%s', (q30, q31) => {
    const answers = {
      ...buildNegativeClosureBase(),
      [AURORA_FIELD_CATALOG.q30]: q30,
      [AURORA_FIELD_CATALOG.q31]: q31,
      [AURORA_FIELD_CATALOG.q32]: '',
      [AURORA_FIELD_CATALOG.q33]: 'No',
      [AURORA_FIELD_CATALOG.q34]: 'No',
      [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Analizar el caso');
    expect(result.visibleBlocks).not.toContain('bloque4');
  });

  it('AURORA.AVANCE.REGLA2.1 - la segunda opción afirmativa de Q39 también permite presentar la solicitud', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q39]:
        'Si desea que el defensor presente solicitud, pero suscrita por la persona privada de la libertad.',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Presentar solicitud');
  });

  it('AURORA.B5.VISIBILIDAD.1 - no abre bloque 5 ni cambia prematuramente de etapa sin fecha de entrevista', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q38]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.visibleBlocks).not.toContain('bloque5TramiteNormal');
    expect(result.derivedStatus).toBe('Entrevistar al usuario');
  });

  it('AURORA.B5.VISIBILIDAD.2 - no abre bloque 5 mientras falte responder Q41 o Q42', () => {
    const base = { ...buildBloque3Base(), ...buildBloque4Base() };

    expect(evaluateAuroraRules({
      answers: { ...base, 'Requiere pruebas': '' },
    }).visibleBlocks).not.toContain('bloque5TramiteNormal');

    expect(evaluateAuroraRules({
      answers: { ...base, 'Poder en caso de avanzar con la solicitud': '' },
    }).visibleBlocks).not.toContain('bloque5TramiteNormal');
  });

  it('AURORA.B5.VISIBILIDAD.3 - abre bloque 5 cuando Q38 a Q42 están completas', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      'Requiere pruebas': 'No',
      'Poder en caso de avanzar con la solicitud': 'No requiere poder',
    };

    expect(evaluateAuroraRules({ answers }).visibleBlocks).toContain('bloque5TramiteNormal');
  });

  it('AURORA.CIERRE.REGLA6.TRAMITE.1 - en trámite normal cierra el caso cuando Q52 está diligenciada', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: 'Favorable',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.RECURSO.TRAMITE.FECHA.1 - Q51 mantiene pendiente hasta responder Q52', () => {
    const base = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: 'Sí',
      [AURORA_FIELD_CATALOG.fechaDecisionRecurso]: '2026-08-12',
    };

    expect(evaluateAuroraRules({ answers: base }).derivedStatus).toBe('Pendiente decisión');
    expect(evaluateAuroraRules({
      answers: {
        ...base,
        [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: 'Favorable',
      },
    }).derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.RECURSO.UTILIDAD.FECHA.1 - Q56 mantiene pendiente hasta responder Q57', () => {
    const base = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Utilidad pública',
      [AURORA_FIELD_CATALOG.q52]: 'Niega utilidad pública',
      [AURORA_FIELD_CATALOG.q54]: 'Sí',
      [AURORA_FIELD_CATALOG.fechaDecisionRecurso]: '2026-08-12',
    };

    expect(evaluateAuroraRules({ answers: base }).derivedStatus).toBe('Pendiente decisión');
    expect(evaluateAuroraRules({
      answers: {
        ...base,
        [AURORA_FIELD_CATALOG.q56]: 'Confirma negativa',
      },
    }).derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.CIERRE.REGLA6.TRAMITE.2 - Q52 diligenciada prevalece y cierra el caso aunque Q49 = "Sí"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: 'Sí',
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: 'Confirma negativa',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.CIERRE.REGLA47.TRAMITE.1 - en trámite normal cierra el caso cuando Q49 (Sentido de la decisión) está diligenciada', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q52]: 'Concede la solicitud',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.ESTADO.RECURSO.TRAMITE.1 - si Q49 niega y Q51 está vacía, la acción es presentar recurso', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Presentar recurso');
  });

  it('AURORA.ESTADO.RECURSO.TRAMITE.2 - si Q49 = "No concede la solicitud" y Q51 = "Sí", pasa a "Pendiente decisión"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: 'Sí',
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.RECURSO.TRAMITE.2B - blinda Q48/Q49/Q51 aunque falten aliases de bloques previos', () => {
    const answers = {
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q53]: 'Porque no se demostró el arraigo familiar o social de la persona privada de la libertad',
      [AURORA_FIELD_CATALOG.q54]: 'Sí',
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.B5B.DECISION_SIN_SENTIDO.1 - Q48 con fecha y Q49 en "-" queda Pendiente decisión', () => {
    const answers = {
      [AURORA_FIELD_CATALOG.b5NormalDecision]: '2026-05-01',
      [AURORA_FIELD_CATALOG.q52]: '-',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.B5A.DECISION_SIN_SENTIDO.1 - Q51 con fecha y Q52 en "-" queda Pendiente decisión', () => {
    const answers = {
      [AURORA_FIELD_CATALOG.q40]: 'Utilidad publica (solo para mujeres)',
      [AURORA_FIELD_CATALOG.q51]: '2026-05-01',
      [AURORA_FIELD_CATALOG.q52]: '-',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.B5.PARCIAL.1 - datos de bloque 5 sin radicación quedan Presentar solicitud, no Analizar', () => {
    const answers = {
      [AURORA_FIELD_CATALOG.b5NormalSolicitudInpec]: '2026-04-28',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Presentar solicitud');
  });

  it('AURORA.ESTADO.B5.RADICACION.1 - radicación de bloque 5 sin decisión queda Pendiente decisión, no Analizar', () => {
    const answers = {
      [AURORA_FIELD_CATALOG.b5NormalRadicacion]: '2026-04-29',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.CIERRE.RECURSO.TRAMITE.1 - si Q49 = "No", el caso queda cerrado', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: 'No',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.ESTADO.RECURSO.UTILIDAD.1 - si utilidad pública niega y Q54 = "Sí", pasa a "Pendiente decisión"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Utilidad publica (solo para mujeres)',
      [AURORA_FIELD_CATALOG.q52]: 'Niega utilidad pública',
      [AURORA_FIELD_CATALOG.q54]: 'Sí',
      [AURORA_FIELD_CATALOG.q56]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.RECURSO.UTILIDAD.1B - si utilidad pública niega y Q54 está vacía, la acción es presentar recurso', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Utilidad publica (solo para mujeres)',
      [AURORA_FIELD_CATALOG.q52]: 'Niega utilidad pública',
      [AURORA_FIELD_CATALOG.q54]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Presentar recurso');
  });

  it('AURORA.ESTADO.UTILIDAD.2 - pasa a "Pendiente decisión" cuando utilidad pública ya tiene radicación', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q40]: 'Utilidad publica (solo para mujeres)',
      [AURORA_FIELD_CATALOG.q43]: '2026-01-11',
      [AURORA_FIELD_CATALOG.q44]: 'Si',
      [AURORA_FIELD_CATALOG.q45]: 'Si',
      [AURORA_FIELD_CATALOG.q46]: 'No',
      [AURORA_FIELD_CATALOG.q49]: '2026-01-12',
      'Fecha de radicación de la solicitud de utilidad pública': '2026-01-13',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.DECISION_SIN_RADICACION.1 - si existe fecha de decisión sin sentido, queda "Pendiente decisión"', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.b5NormalDecision]: '2026-04-16',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });
});
