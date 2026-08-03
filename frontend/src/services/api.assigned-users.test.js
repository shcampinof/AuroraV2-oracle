import { describe, expect, it } from 'vitest';
import { getCondenadosFilterOptionsRequest, getCondenadosRequest } from './api.js';

const API_FILTER_KEYS = [
  'defensor',
  'defensorId',
  'nombre',
  'documento',
  'lugar',
  'centroId',
  'departamento',
  'municipio',
  'estadoAccion',
  'estadoCodigo',
  'estado',
  'accionCodigo',
  'accion',
  'potencialSubrogado',
];

describe('contrato API de filtros de usuarios asignados', () => {
  it('serializa todos los filtros admitidos sin perder IDs ni códigos', () => {
    const filters = Object.fromEntries(API_FILTER_KEYS.map((key) => [key, `  valor-${key}  `]));
    const request = getCondenadosRequest({
      tipo: 'all',
      limit: 50,
      filteredLimit: 100,
      forceRefresh: true,
      filters,
    });
    const params = new URLSearchParams(request.key);
    expect(params.get('tipo')).toBe('all');
    expect(params.get('limit')).toBe('50');
    expect(params.get('filteredLimit')).toBe('100');
    API_FILTER_KEYS.forEach((key) => expect(params.get(key)).toBe(`valor-${key}`));
    expect(request.forceRefresh).toBe(true);
  });

  it('aplica límites seguros y no marca como filtrada una consulta vacía', () => {
    const request = getCondenadosRequest({ tipo: 'valor-invalido', limit: 99999, filteredLimit: 999 });
    const params = new URLSearchParams(request.key);
    expect(params.has('tipo')).toBe(false);
    expect(params.get('limit')).toBe('10000');
    expect(params.has('filteredLimit')).toBe(false);
  });

  it('serializa únicamente los filtros que condicionan las opciones dependientes', () => {
    const request = getCondenadosFilterOptionsRequest({
      tipo: 'sindicado',
      filters: {
        departamento: 'BOYACA',
        municipio: 'TUNJA',
        defensor: 'DEFENSOR',
        defensorId: '123',
        centroId: 'CENTRO_1',
        documento: 'no-debe-viajar',
      },
    });
    const params = new URLSearchParams(request.key);
    expect(Object.fromEntries(params.entries())).toEqual({
      tipo: 'sindicado',
      departamento: 'BOYACA',
      municipio: 'TUNJA',
      defensor: 'DEFENSOR',
      defensorId: '123',
      centroId: 'CENTRO_1',
    });
  });
});
