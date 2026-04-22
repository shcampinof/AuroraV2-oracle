import { describe, expect, it } from 'vitest';
import { AURORA_FIELD_CATALOG } from './formRules.aurora';
import {
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
    'Fecha de analisis juridico del caso': formatDateDaysAgo(5),
    [AURORA_FIELD_CATALOG.q37]: 'Resumen del caso',
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

  it('ESTADO.CASO_CERRADO.2 - en trÃ¡mite normal cierra cuando Q47 (Sentido de la decisiÃ³n) estÃ¡ diligenciada', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'SÃ­, desea que el defensor(a) pÃºblico(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'Concede la solicitud',
    });
    expect(estado.etiqueta).toBe('Caso cerrado');
    expect(estado.claseFinal).toBe('estado--gris');
  });

  it('ESTADO.RECURSO.TRAMITE.1 - con Q47 = "No concede la solicitud" y Q49 vacÃ­a, queda Presentar solicitud', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'SÃ­, desea que el defensor(a) pÃºblico(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: '',
    });
    expect(estado.etiqueta).toBe('Presentar solicitud');
    expect(estado.claseFinal).toBe('estado--verde');
  });

  it('ESTADO.RECURSO.TRAMITE.2 - con Q47 = "No concede la solicitud" y Q49 = "SÃ­", queda Pendiente decisiÃ³n', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'SÃ­, desea que el defensor(a) pÃºblico(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: 'SÃ­',
      [AURORA_FIELD_CATALOG.b5NormalSentidoResuelveSolicitud]: '',
    });
    expect(estado.etiqueta).toBe('Pendiente decisión');
    expect(estado.claseFinal).toBe('estado--azul');
  });

  it('ESTADO.RECURSO.TRAMITE.3 - con Q49 = "No" el caso se cierra', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'SÃ­, desea que el defensor(a) pÃºblico(a) avance con la solicitud',
      [AURORA_FIELD_CATALOG.q40]: 'Libertad condicional',
      [AURORA_FIELD_CATALOG.q52]: 'No concede la solicitud',
      [AURORA_FIELD_CATALOG.q54]: 'No',
    });
    expect(estado.etiqueta).toBe('Caso cerrado');
    expect(estado.claseFinal).toBe('estado--gris');
  });

  it('ESTADO.MOJIBAKE.1 - "SÃ­" en decision del usuario no cierra el caso por error', () => {
    const estado = obtenerEstadoActuacion({
      ...buildBloque3Base(),
      [AURORA_FIELD_CATALOG.q38]: formatDateDaysAgo(1),
      [AURORA_FIELD_CATALOG.q39]: 'SÃ­, desea que el defensor(a) pÃºblico(a) avance con la solicitud',
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
        'Fecha de presentaciÃ³n de solicitud a la autoridad judicial': formatDateDaysAgo(1),
      },
    });
    expect(display.label).toBe('Pendiente decisi\u00f3n');
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

  it('ESTADO.SINDICADO.1 - con Q19-Q22 completas y Q21 "Se avanzarÃ¡...", muestra Entrevistar al usuario', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'SituaciÃ³n JurÃ­dica': 'Sindicado',
        'Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de anÃ¡lisis jurÃ­dico del caso': formatDateDaysAgo(2),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÃ‰RMINOS':
          'Se avanzarÃ¡ con solicitud de revocatoria o sustituciÃ³n de la medida',
        'RESUMEN DEL ANÃLISIS JURÃDICO DEL PRESENTE CASO': 'Resumen',
      },
    });
    expect(display.label).toBe('Entrevistar al usuario');
    expect(display.className).toBe('estado--verde');
  });

  it('ESTADO.SINDICADO.2 - con Q24/Q25 diligenciadas y Q26 niega, muestra Presentar recurso', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'SituaciÃ³n JurÃ­dica': 'Sindicado',
        'Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de anÃ¡lisis jurÃ­dico del caso': formatDateDaysAgo(4),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÃ‰RMINOS':
          'Se avanzarÃ¡ con solicitud de revocatoria o sustituciÃ³n de la medida',
        'RESUMEN DEL ANÃLISIS JURÃDICO DEL PRESENTE CASO': 'Resumen',
        'Fecha de entrevista': formatDateDaysAgo(3),
        'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÃAS PARA SUSTENTAR REVOCATORIA': formatDateDaysAgo(2),
        'FECHA DE REALIZACIÃ“N DE AUDIENCIA': formatDateDaysAgo(1),
        'SENTIDO DE LA DECISIÃ“N': 'Niega la solicitud',
      },
    });
    expect(display.label).toBe('Presentar recurso');
    expect(display.className).toBe('estado--rojo');
  });

  it('ESTADO.SINDICADO.3 - con Q24 diligenciada y Q25 vacía, muestra Pendiente audiencia sin color', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'SituaciÃ³n JurÃ­dica': 'Sindicado',
        'Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de anÃ¡lisis jurÃ­dico del caso': formatDateDaysAgo(4),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÃ‰RMINOS':
          'Se avanzarÃ¡ con solicitud de revocatoria o sustituciÃ³n de la medida',
        'RESUMEN DEL ANÃLISIS JURÃDICO DEL PRESENTE CASO': 'Resumen',
        'Fecha de entrevista': formatDateDaysAgo(3),
        'FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÃAS PARA SUSTENTAR REVOCATORIA': formatDateDaysAgo(2),
      },
    });
    expect(display.label).toBe('Pendiente audiencia');
    expect(display.className).toBe('');
  });

  it('ESTADO.SINDICADO.4 - con Q25 diligenciada y Q26 vacía, muestra Pendiente decisión de audiencia sin color', () => {
    const display = getEstadoDisplayInfo({
      estadoSource: {
        'SituaciÃ³n JurÃ­dica': 'Sindicado',
        'Defensor(a) PÃºblico(a) Asignado para tramitar la solicitud': 'DEFENSOR',
        'Fecha de anÃ¡lisis jurÃ­dico del caso': formatDateDaysAgo(4),
        'PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÃ‰RMINOS':
          'Se avanzarÃ¡ con solicitud de revocatoria o sustituciÃ³n de la medida',
        'RESUMEN DEL ANÃLISIS JURÃDICO DEL PRESENTE CASO': 'Resumen',
        'Fecha de entrevista': formatDateDaysAgo(3),
        'FECHA DE REALIZACIÃ“N DE AUDIENCIA': formatDateDaysAgo(1),
      },
    });
    expect(display.label).toBe('Pendiente decisión de audiencia');
    expect(display.className).toBe('');
  });
});



