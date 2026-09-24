import { describe, expect, it } from 'vitest';
import {
  buildDefensorNameOptions,
  isNombreDefensorValido,
  normalizeDefensorNombre,
  normalizeDefensorNombreInput,
  resolveDefensorAsignadoParaGuardar,
  resolveDefensorCatalogado,
} from './defensores.js';

describe('normalizacion de defensores', () => {
  it('permite escribir nombres separados y conserva un unico espacio temporal al final', () => {
    expect(normalizeDefensorNombreInput('sebastian ')).toBe('SEBASTIAN ');
    expect(normalizeDefensorNombreInput(' sebastian   campino')).toBe('SEBASTIAN CAMPINO');
    expect(normalizeDefensorNombre('  sebastian   campino  ')).toBe('SEBASTIAN CAMPINO');
  });

  it('admite solo palabras compuestas por letras y separadas por un espacio', () => {
    expect(isNombreDefensorValido('SEBASTIAN CAMPINO')).toBe(true);
    expect(isNombreDefensorValido('MARIA JOSE MUÑOZ')).toBe(true);
    expect(isNombreDefensorValido('SEBASTIAN  CAMPINO ')).toBe(true);
    expect(isNombreDefensorValido('SEBASTIAN-CAMPINO')).toBe(false);
  });

  it('deduplica nombres equivalentes aunque cambien espacios, tildes o mayusculas', () => {
    const options = buildDefensorNameOptions(
      [{ id: '16229499', nombre: 'DIEGO ALEXANDER RODRIGUEZ' }],
      'Diego Alexander  Rodríguez'
    );

    expect(options).toEqual(['DIEGO ALEXANDER RODRIGUEZ']);
    expect(resolveDefensorCatalogado('Diego Alexander  Rodríguez', options)).toBe(
      'DIEGO ALEXANDER RODRIGUEZ'
    );
  });

  it('acepta una asignacion existente y sin cambios por su cedula aunque el catalogo no este cargado', () => {
    expect(
      resolveDefensorAsignadoParaGuardar({
        value: 'DIEGO ALEXANDER RODRIGUEZ',
        originalValue: 'DIEGO ALEXANDER  RODRÍGUEZ',
        assignedId: '16229499',
        catalogo: [],
        options: [],
      })
    ).toBe('DIEGO ALEXANDER RODRIGUEZ');
  });

  it('canoniza por cedula una asignacion cuyo snapshot conserva espacios dobles', () => {
    expect(
      resolveDefensorAsignadoParaGuardar({
        value: 'DIEGO ALEXANDER  RODRÍGUEZ',
        originalValue: 'DIEGO ALEXANDER  RODRÍGUEZ',
        assignedId: '16229499',
        catalogo: [{ id: '16229499', nombre: 'DIEGO ALEXANDER RODRIGUEZ' }],
        options: ['DIEGO ALEXANDER RODRIGUEZ'],
      })
    ).toBe('DIEGO ALEXANDER RODRIGUEZ');
  });

  it('exige catalogo cuando el usuario cambia realmente el defensor', () => {
    expect(
      resolveDefensorAsignadoParaGuardar({
        value: 'OTRO DEFENSOR',
        originalValue: 'DIEGO ALEXANDER RODRIGUEZ',
        assignedId: '16229499',
        catalogo: [],
        options: [],
      })
    ).toBe('');
  });
});
