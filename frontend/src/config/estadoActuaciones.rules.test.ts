import { describe, expect, it } from 'vitest';
import { AURORA_FIELD_CATALOG } from './formRules.aurora';
import {
  getEstadoClassForRecord,
  getEstadoDisplayInfo,
  getSemaforoClassByDays,
  obtenerEstadoActuacion,
} from './estadoActuaciones.rules';

function formatDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildBloque3Base(): Record<string, unknown> {
  return {
    'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR DE PRUEBA',
    'Fecha de analisis juridico del caso': formatDateDaysAgo(5),
    [AURORA_FIELD_CATALOG.q30]: 'Sí',
    [AURORA_FIELD_CATALOG.q31]: 'No',
    [AURORA_FIELD_CATALOG.q33]: 'No',
    [AURORA_FIELD_CATALOG.q34]: 'No',
    [AURORA_FIELD_CATALOG.q36]: 'Ninguna',
    [AURORA_FIELD_CATALOG.q37]: 'Resumen del caso',
    [AURORA_FIELD_CATALOG.q39]: 'Sí, desea que el defensor(a) público(a) avance con la solicitud',
    [AURORA_FIELD_CATALOG.q41]: 'No',
    'Poder en caso de avanzar con la solicitud': 'Sí',
  };
}

describe('estadoActuaciones.rules', () => {
  it('ESTADO.ANALIZAR.1 - etiqueta Analizar el caso cuando el caso no tiene analisis completo', () => {
    const estado = obtenerEstadoActuacion({ fechaAsignacionPAG: formatDateDaysAgo(10) });
    expect(estado.etiqueta).toBe('Analizar el caso');
    expect(estado.claseFinal).toBe('estado--verde');
  });

  it('ESTADO.ENTREVISTAR.1 - etiqueta Entrevistar al usuario cuando falta entrevista o actuacion', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
    });
    expect(estado.etiqueta).toBe('Entrevistar al usuario');
    expect(estado.claseFinal).toBe('estado--verde');
  });

  it('ESTADO.ENTREVISTAR.2 - campos condicionales vacíos no regresan el estado a Analizar el caso', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: '',
      [AURORA_FIELD_CATALOG.q40]: '',
      [AURORA_FIELD_CATALOG.q41]: '',
      [AURORA_FIELD_CATALOG.b5NormalRecepcionPruebas]: '',
      [AURORA_FIELD_CATALOG.q55]: '',
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: '',
    });

    expect(estado.etiqueta).toBe('Entrevistar al usuario');
  });

  it('ESTADO.FLUJO.1 - la situación jurídica actualizada prevalece sobre la situación histórica', () => {
    const estado = obtenerEstadoActuacion({
      'Situación Jurídica': 'Sindicado',
      'Situación Jurídica actualizada (de conformidad con la rama judicial)': 'Condenado',
      ...buildBloque3Base(),
    });

    expect(estado.etiqueta).toBe('Entrevistar al usuario');
  });

  it('ESTADO.SOLICITUD.1 - etiqueta Presentar solicitud cuando bloque base esta completo y falta radicacion', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(5),
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
    });
    expect(estado.etiqueta).toBe('Presentar solicitud');
    expect(estado.claseFinal).toBe('estado--verde');
  });

  it('ESTADO.PENDIENTE_DECISION.1 - etiqueta Pendiente decision cuando ya existe radicacion y falta decision', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(5),
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.b5NormalRadicacion]: formatDateDaysAgo(2),
    });
    expect(estado.etiqueta).toBe('Pendiente decisi\u00f3n');
    expect(estado.claseFinal).toBe('estado--azul');
  });

  it('ESTADO.CASO_CERRADO.1 - etiqueta Caso cerrado cuando la decision del usuario no permite continuar', () => {
    const estado = obtenerEstadoActuacion({
      [AURORA_FIELD_CATALOG.q39]: 'No desea tramitar la solicitud',
    });
    expect(estado.etiqueta).toBe('Caso cerrado');
    expect(estado.claseFinal).toBe('estado--gris');
  });

  it('ESTADO.CASO_CERRADO.2 - en trámite normal cierra cuando Q49 (Sentido de la decisión) está diligenciada', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'Sí, desea que el defensor(a) público(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'Concede la solicitud',
    });
    expect(estado.etiqueta).toBe('Caso cerrado');
    expect(estado.claseFinal).toBe('estado--gris');
  });

  it('ESTADO.RECURSO.TRAMITE.1 - con Q49 negativa y Q51 vacía, queda Presentar recurso', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'Sí, desea que el defensor(a) público(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: '',
    });
    expect(estado.etiqueta).toBe('Presentar recurso');
    expect(estado.claseFinal).toBe('estado--rojo');
  });

  it('ESTADO.RECURSO.TRAMITE.2 - con Q49 = "No concede la solicitud" y Q51 = "Sí", queda Pendiente decisión', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'Sí, desea que el defensor(a) público(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: 'Sí',
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: '',
    });
    expect(estado.etiqueta).toBe('Pendiente decisión');
    expect(estado.claseFinal).toBe('estado--azul');
  });

  it('ESTADO.RECURSO.TRAMITE.3 - con Q49 = "No" el caso se cierra', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'Sí, desea que el defensor(a) público(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: 'No',
    });
    expect(estado.etiqueta).toBe('Caso cerrado');
    expect(estado.claseFinal).toBe('estado--gris');
  });

  it('ESTADO.MOJIBAKE.1 - "Sí" en decision del usuario no cierra el caso por error', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'Sí, desea que el defensor(a) público(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
    });
    expect(estado.etiqueta).toBe('Presentar solicitud');
    expect(estado.claseFinal).toBe('estado--verde');
  });

  it('ESTADO.SEMAFORO.VERDE.1 - dias <= 15 retorna verde', () => {
    expect(getSemaforoClassByDays(15)).toBe('estado--verde');
  });

  it('ESTADO.SEMAFORO.AMARILLO.1 - dias entre 16 y 30 retorna amarillo', () => {
    expect(getSemaforoClassByDays(16)).toBe('estado--amarillo');
    expect(getSemaforoClassByDays(30)).toBe('estado--amarillo');
  });

  it('ESTADO.SEMAFORO.ROJO.1 - dias > 30 retorna rojo', () => {
    expect(getSemaforoClassByDays(31)).toBe('estado--rojo');
  });

  it('ESTADO.SEMAFORO.CANONICO.1 - colorea Entrevistar con su fecha aunque otros datos históricos sugieran cierre', () => {
    const row = {
      estadoEtiqueta: 'Entrevistar al usuario',
      estadoSource: {
        'Fecha de análisis jurídico del caso': formatDateDaysAgo(31),
        'Sentido de la decisión': 'Concede la solicitud',
      },
    };
    expect(getEstadoClassForRecord(row, row.estadoEtiqueta)).toBe('estado--rojo');
  });

  it('ESTADO.PAG.RESUMEN.1 - fila resumida de PAG resuelve Analizar el caso', () => {
    const estado = obtenerEstadoActuacion({
      numeroIdentificacion: '123456',
      nombreUsuario: 'USUARIO PRUEBA',
      situacionJuridica: 'Condenado',
      municipioLugarReclusion: 'BOGOTA',
    });
    expect(estado.etiqueta).toBe('Analizar el caso');
    expect(estado.claseFinal).toBe('estado--verde');
  });

  it('ESTADO.DISPLAY.1 - getEstadoDisplayInfo usa la misma etiqueta y clase final', () => {
    const display = getEstadoDisplayInfo({
      numeroIdentificacion: '987654',
      nombreUsuario: 'USUARIO PRUEBA 2',
      situacionJuridica: 'Condenado',
    });
    expect(display.label).toBe('Analizar el caso');
    expect(display.className).toBe('estado--verde');
  });

  it('ESTADO.SOURCE.1 - getEstadoDisplayInfo prioriza estadoSource para filas resumidas', () => {
    const display = getEstadoDisplayInfo({
      numeroIdentificacion: '2766223',
      nombreUsuario: 'OTONIEL MERA',
      situacionJuridica: 'Condenado',
      estadoSource: {
        ...buildBloque3Base(),
        'Fecha de analisis juridico del caso': formatDateDaysAgo(2),
        [AURORA_FIELD_CATALOG.q37]: 'Resumen vigente',
        [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
        [AURORA_FIELD_CATALOG.q40]: 'Redencion de pena',
      },
    });
    expect(display.label).toBe('Presentar solicitud');
    expect(display.className).toBe('estado--verde');
  });

  it('ESTADO.RADICACION_ALIAS.1 - reconoce alias historico de fecha de presentacion y pasa a pendiente decision', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        ...buildBloque3Base(),
        [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(2),
        [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
        'Fecha de presentación de solicitud a la autoridad judicial': formatDateDaysAgo(1),
      },
    });
    expect(display.label).toBe('Pendiente decisi\u00f3n');
    expect(display.className).toBe('estado--azul');
  });

  it('ESTADO.SOURCE.AURORA_RECURSO.1 - fila resumida queda pendiente si falta el sentido del recurso', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        ...buildBloque3Base(),
        [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(8),
        [AURORA_FIELD_CATALOG.q40]: 'Utilidad pública (solo mujeres)',
        'Fecha de radicacion de solicitud de utilidad publica': formatDateDaysAgo(6),
        'Fecha de decision de la autoridad': formatDateDaysAgo(4),
        'Sentido de la decision': 'Niega utilidad pública',
        'Se presenta recurso': 'Sí',
        'Fecha de la decision del recurso': formatDateDaysAgo(1),
      },
    });

    expect(display.label).toBe('Pendiente decisión');
    expect(display.className).toBe('estado--azul');
  });

  it('ESTADO.ACTUACION_RECIENTE.1 - cuando hay multiples actuaciones toma la mas reciente', () => {
    const display = getEstadoDisplayInfo({
      data: {
        ...buildBloque3Base(),
      },
      casos: [
        {
          caseId: 'case-3',
          data: {
            ...buildBloque3Base(),
            [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(10),
            [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
          },
        },
        {
          caseId: 'case-9',
          data: {
            ...buildBloque3Base(),
            [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(4),
            [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
            [AURORA_FIELD_CATALOG.b5NormalRadicacion]: formatDateDaysAgo(1),
          },
        },
      ],
    });
    expect(display.label).toBe('Pendiente decisi\u00f3n');
  });

  it('ESTADO.NO_PROCEDE_NADA.1 - marca Caso cerrado cuando actuacion indica no procede nada', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        ...buildBloque3Base(),
        [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(2),
        [AURORA_FIELD_CATALOG.q40]: 'NO PROCEDE NADA',
      },
    });
    expect(display.label).toBe('Caso cerrado');
    expect(display.className).toBe('estado--gris');
  });

  it('ESTADO.SINDICADO.1 - con Q19-Q22 completas y Q21 "Se avanzará...", muestra Entrevistar al usuario', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'Situación Jurídica': 'Sindicado',
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de análisis jurídico del caso': formatDateDaysAgo(2),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS':
          'Se avanzará con solicitud de revocatoria o sustitución de la medida',
        'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': 'Resumen',
      },
    });
    expect(display.label).toBe('Entrevistar al usuario');
    expect(display.className).toBe('estado--verde');
  });

  it('ESTADO.SINDICADO.1B - bloque 5 vacío no cambia Entrevistar al usuario a Analizar el caso', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'Situación Jurídica': 'Sindicado',
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de análisis jurídico del caso': formatDateDaysAgo(2),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS':
          'Se avanzará con solicitud de revocatoria o sustitución de la medida',
        'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': 'Resumen',
        'Fecha de entrevista': '',
        'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA': '',
        'FECHA DE REALIZACIÓN DE AUDIENCIA': '',
        'SENTIDO DE LA DECISIÓN': '',
        '¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?': '',
      },
    });

    expect(display.label).toBe('Entrevistar al usuario');
  });

  it('ESTADO.SINDICADO.2 - con Q26 negativa y recurso sin definir, muestra Presentar recurso', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'Situación Jurídica': 'Sindicado',
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de análisis jurídico del caso': formatDateDaysAgo(4),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS':
          'Se avanzará con solicitud de revocatoria o sustitución de la medida',
        'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': 'Resumen',
        'Fecha de entrevista': formatDateDaysAgo(3),
        'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA': formatDateDaysAgo(2),
        'FECHA DE REALIZACIÓN DE AUDIENCIA': formatDateDaysAgo(1),
        'SENTIDO DE LA DECISIÓN': 'Niega la solicitud',
      },
    });
    expect(display.label).toBe('Presentar recurso');
    expect(display.className).toBe('estado--rojo');
  });

  it('ESTADO.SINDICADO.RESUMEN.1 - fila resumida con aliases Oracle cierra con decision de recurso', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'Situacion Juridica': 'Sindicado',
        'Defensor(a) Publico(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de analisis juridico del caso': formatDateDaysAgo(8),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TERMINOS':
          'Se avanzará con solicitud de revocatoria o sustitución de la medida',
        'RESUMEN DEL ANALISIS JURIDICO DEL PRESENTE CASO': 'Resumen',
        'Fecha de entrevista': formatDateDaysAgo(7),
        'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTIAS PARA SUSTENTAR REVOCATORIA':
          formatDateDaysAgo(6),
        'FECHA DE REALIZACION DE AUDIENCIA': formatDateDaysAgo(5),
        'SENTIDO DE LA DECISION': 'Niega la solicitud',
        'SE RECURRIO EN CASO DE DECISION NEGATIVA': 'Sí',
        'Fecha de presentacion del recurso': formatDateDaysAgo(4),
        'Fecha de la decision del recurso': formatDateDaysAgo(1),
      },
    });

    expect(display.label).toBe('Caso cerrado');
    expect(display.className).toBe('estado--gris');
  });

  it('ESTADO.SINDICADO.3 - con Q24 diligenciada y Q25 vacía, muestra Pendiente audiencia azul', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'Situación Jurídica': 'Sindicado',
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de análisis jurídico del caso': formatDateDaysAgo(4),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS':
          'Se avanzará con solicitud de revocatoria o sustitución de la medida',
        'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': 'Resumen',
        'Fecha de entrevista': formatDateDaysAgo(3),
        'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA': formatDateDaysAgo(2),
      },
    });
    expect(display.label).toBe('Pendiente audiencia');
    expect(display.className).toBe('estado--azul');
  });

  it('ESTADO.SINDICADO.4 - con Q25 diligenciada y Q26 vacía, muestra Pendiente decisión de audiencia azul', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'Situación Jurídica': 'Sindicado',
        'Defensor(a) Público(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de análisis jurídico del caso': formatDateDaysAgo(4),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS':
          'Se avanzará con solicitud de revocatoria o sustitución de la medida',
        'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO': 'Resumen',
        'Fecha de entrevista': formatDateDaysAgo(3),
        'FECHA DE REALIZACIÓN DE AUDIENCIA': formatDateDaysAgo(1),
      },
    });
    expect(display.label).toBe('Pendiente decisión de audiencia');
    expect(display.className).toBe('estado--azul');
  });
});
