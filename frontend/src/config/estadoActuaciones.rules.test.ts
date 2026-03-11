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
});
