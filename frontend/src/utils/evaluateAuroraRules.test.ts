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

  it('AURORA.B5B.DEPENDENCIA.4 - deshabilita motivo y recurso cuando Q47 != "No concede la solicitud"', () => {
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

  it('AURORA.B5B.DEPENDENCIA.2 - habilita campos de recurso cuando Q47 = "No concede la solicitud" y Q49 = "Si"', () => {
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

  it('AURORA.ESTADO.INICIAL.1 - con 29 y 37 diligenciadas, y sin 38/40, debe quedar "Entrevistar al usuario"', () => {
    const answers = {
      'Fecha de análisis jurídico del caso': '2026-01-10',
      [AURORA_FIELD_CATALOG.q37]: 'Resumen del caso',
      [AURORA_FIELD_CATALOG.q38]: '',
      [AURORA_FIELD_CATALOG.q40]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Entrevistar al usuario');
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

  it('AURORA.CIERRE.REGLA6.TRAMITE.1 - en trámite normal cierra el caso cuando Q52 está diligenciada', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: 'Favorable',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
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

  it('AURORA.CIERRE.REGLA47.TRAMITE.1 - en trámite normal cierra el caso cuando Q47 (Sentido de la decisión) está diligenciada', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q52]: 'Concede la solicitud',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Caso cerrado');
  });

  it('AURORA.ESTADO.RECURSO.TRAMITE.1 - si Q47 niega y Q49 está vacía, la acción es presentar recurso', () => {
    const answers = {
      ...buildBloque3Base(),
      ...buildBloque4Base(),
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Presentar recurso');
  });

  it('AURORA.ESTADO.RECURSO.TRAMITE.2 - si Q47 = "No concede la solicitud" y Q49 = "Sí", pasa a "Pendiente decisión"', () => {
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

  it('AURORA.ESTADO.RECURSO.TRAMITE.2B - blinda Q47/Q48/Q49 aunque falten aliases de bloques previos', () => {
    const answers = {
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q53]: 'Porque no se demostró el arraigo familiar o social de la persona privada de la libertad',
      [AURORA_FIELD_CATALOG.q54]: 'Sí',
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: '',
    };

    const result = evaluateAuroraRules({ answers });
    expect(result.derivedStatus).toBe('Pendiente decisión');
  });

  it('AURORA.ESTADO.B5B.DECISION_SIN_SENTIDO.1 - Q46 con fecha y Q47 en "-" queda Pendiente decisión', () => {
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
