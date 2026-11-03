// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RegistrosAsignados from './RegistrosAsignados.jsx';
import {
  PPL_DATA_UPDATED_EVENT,
  getCachedCondenados,
  getCondenados,
  getCondenadosFilterOptions,
} from '../services/api.js';

vi.mock('../services/api.js', () => ({
  PPL_DATA_UPDATED_EVENT: 'aurora:ppl-data-updated',
  getCachedCondenados: vi.fn(),
  getCachedCondenadosFilterOptions: vi.fn(),
  getCondenados: vi.fn(),
  getCondenadosFilterOptions: vi.fn(),
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function payload(nombre = 'Usuario inicial', documento = '123', page = 1) {
  return {
    columns: ['numeroIdentificacion', 'Nombre'],
    rows: [{ numeroIdentificacion: documento, Nombre: nombre }],
    meta: { totalMatched: 100, totalPages: 2, page },
  };
}

describe('actualización automática de usuarios asignados', () => {
  let container;
  let root;
  let onSelectRegistro;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getCondenadosFilterOptions.mockResolvedValue({});
    getCondenados.mockResolvedValue(payload());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onSelectRegistro = vi.fn();
    await act(async () => root.render(<RegistrosAsignados onSelectRegistro={onSelectRegistro} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function click(text) {
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent === text);
    expect(button).toBeDefined();
    await act(async () => button.click());
  }

  async function setDocumento(value) {
    const input = container.querySelector('input[placeholder="Ingrese cédula"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function search() {
    await setDocumento('123');
    await click('Buscar');
  }

  async function notify() {
    await act(async () => window.dispatchEvent(new CustomEvent(PPL_DATA_UPDATED_EVENT)));
  }

  async function selectFilter(label, value) {
    const field = [...container.querySelectorAll('label')].find((item) => item.textContent === label);
    expect(field).toBeDefined();
    const control = document.getElementById(field.htmlFor);
    await act(async () => {
      control.value = value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return control;
  }

  it('busca por regional y tiempo del estado y los conserva al paginar', async () => {
    getCondenadosFilterOptions.mockResolvedValue({ regionales: ['BOYACÁ'] });
    await notify();
    await selectFilter('Regional', 'BOYACÁ');
    await selectFilter('Tiempo del estado', 'rojo');
    const additionalLabel = [...container.querySelectorAll('label')].find((item) => item.textContent === 'Filtrar');
    const additional = document.getElementById(additionalLabel.htmlFor);
    expect([...additional.options].map((item) => item.textContent).join(' ')).not.toContain('Regional');
    expect([...additional.options].map((item) => item.textContent).join(' ')).not.toContain('Prioridad');
    await selectFilter('Filtrar', 'nombre');
    await click('Buscar');
    expect(getCondenados.mock.lastCall[0].filters).toMatchObject({ regional: 'BOYACÁ', prioridadGestion: 'rojo' });
    await click('Siguiente');
    expect(getCondenados.mock.lastCall[0]).toMatchObject({ page: 2, filters: { regional: 'BOYACÁ', prioridadGestion: 'rojo' } });
    await click('Limpiar');
    const primarySelects = [...container.querySelectorAll('.asignados-filter-grid select')];
    expect(primarySelects.every((item) => item.value === '')).toBe(true);
  });

  it('permite buscar sin asignación y usa el color calculado en el servidor', async () => {
    const data = payload();
    data.rows[0] = { ...data.rows[0], situacionActiva: true, estadoCodigo: 'SIN_ASIGNACION',
      estadoEtiqueta: 'Sin asignación', prioridadGestion: 'gris' };
    getCondenados.mockResolvedValue(data);
    await selectFilter('Acción a Impulsar / estado', 'SIN_ASIGNACION');
    await click('Buscar');
    expect(getCondenados.mock.lastCall[0].filters.estadoCodigo).toBe('SIN_ASIGNACION');
    expect(container.querySelector('.estadoBadge').textContent).toBe('Sin asignación');
    expect(container.querySelector('.estadoBadge').classList.contains('estado--gris')).toBe(true);
    expect(container.querySelector('table').style.width).toMatch(/px$/);
  });

  it('mantiene las filas y permite abrir el formulario mientras actualiza en segundo plano', async () => {
    await search();
    const update = deferred();
    getCondenados.mockReturnValueOnce(update.promise);
    await notify();

    expect(container.querySelector('.loading-overlay')).toBeNull();
    expect(container.textContent).toContain('Usuario inicial');
    expect(container.querySelector('input[placeholder="Ingrese cédula"]')).not.toBeNull();
    await act(async () => container.querySelector('tbody tr.clickable-row').click());
    expect(onSelectRegistro).toHaveBeenCalledWith({ numeroIdentificacion: '123' });

    await act(async () => update.resolve(payload('Usuario actualizado')));
    expect(container.textContent).toContain('Usuario actualizado');
    expect(container.textContent).not.toContain('Usuario inicial');
  });

  it('conserva las filas y la paginación si falla la actualización y permite recuperarse', async () => {
    await search();
    getCondenados.mockRejectedValueOnce(new Error('FETCH_TIMEOUT'));
    await notify();

    expect(container.querySelector('.loading-overlay')).toBeNull();
    expect(container.textContent).toContain('Usuario inicial');
    expect(container.textContent).toContain('Página 1 de 2');
    expect(container.textContent).toContain('Se conserva la información de la última consulta.');

    getCondenados.mockResolvedValueOnce(payload('Recuperado'));
    await notify();
    expect(container.textContent).toContain('Recuperado');
    expect(container.textContent).not.toContain('No fue posible actualizar');
  });

  it('agrupa los avisos repetidos en una única consulta posterior', async () => {
    await search();
    const update = deferred();
    getCondenados.mockReturnValueOnce(update.promise);
    await notify();
    await notify();
    await notify();
    expect(getCondenados).toHaveBeenCalledTimes(2);

    getCondenados.mockResolvedValueOnce(payload('Última versión'));
    await act(async () => update.resolve(payload('Versión intermedia')));
    expect(getCondenados).toHaveBeenCalledTimes(3);
    expect(container.textContent).toContain('Última versión');
    expect(container.querySelector('.loading-overlay')).toBeNull();
  });

  it('da prioridad a una búsqueda nueva e ignora la respuesta automática anterior', async () => {
    await search();
    const update = deferred();
    getCondenados.mockReturnValueOnce(update.promise);
    await notify();
    await setDocumento('456');
    getCondenados.mockResolvedValueOnce(payload('Otro usuario', '456'));
    await click('Buscar');
    await act(async () => update.resolve(payload('Respuesta antigua')));

    expect(container.textContent).toContain('Otro usuario');
    expect(container.textContent).not.toContain('Respuesta antigua');
    expect(getCondenados.mock.lastCall[0].filters.documento).toBe('456');
  });

  it('una respuesta antigua no oculta el indicador de una búsqueda manual pendiente', async () => {
    await search();
    const update = deferred();
    const manual = deferred();
    getCondenados.mockReturnValueOnce(update.promise);
    await notify();
    await setDocumento('456');
    getCondenados.mockReturnValueOnce(manual.promise);
    await click('Buscar');
    await act(async () => update.resolve(payload('Respuesta antigua')));
    expect(container.querySelector('.loading-overlay')).not.toBeNull();

    await act(async () => manual.resolve(payload('Otro usuario', '456')));
    expect(container.querySelector('.loading-overlay')).toBeNull();
    expect(container.textContent).toContain('Otro usuario');
  });

  it('respeta el cambio de página durante una actualización automática', async () => {
    await search();
    const update = deferred();
    getCondenados.mockReturnValueOnce(update.promise);
    await notify();
    getCondenados.mockResolvedValueOnce(payload('Página siguiente', '456', 2));
    await click('Siguiente');
    await act(async () => update.reject(new Error('Consulta anterior fallida')));

    expect(container.textContent).toContain('Página siguiente');
    expect(container.textContent).toContain('Página 2 de 2');
    expect(container.textContent).not.toContain('No fue posible actualizar');
    expect(getCondenados.mock.lastCall[0].page).toBe(2);
  });

  it('descarta las actualizaciones pendientes al limpiar los filtros', async () => {
    await search();
    const update = deferred();
    getCondenados.mockReturnValueOnce(update.promise);
    await notify();
    await notify();
    await click('Limpiar');
    await act(async () => update.resolve(payload('Respuesta antigua')));

    expect(container.textContent).not.toContain('Respuesta antigua');
    expect(container.textContent).toContain('Ingrese al menos un filtro y presione Buscar.');
    expect(getCondenados).toHaveBeenCalledTimes(2);
  });

  it('mantiene el indicador y el tratamiento de errores para las búsquedas manuales', async () => {
    const manual = deferred();
    getCondenados.mockReturnValueOnce(manual.promise);
    await search();
    expect(container.querySelector('.loading-overlay')).not.toBeNull();
    await notify();
    expect(getCondenados).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.loading-overlay')).not.toBeNull();

    await act(async () => manual.resolve(payload()));
    expect(getCondenados).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.loading-overlay')).toBeNull();
    getCondenados.mockRejectedValueOnce(new Error('Error de búsqueda'));
    await click('Buscar');
    expect(container.textContent).toContain('Error de búsqueda');
    expect(container.textContent).not.toContain('Usuario inicial');
  });

  it('no consulta filas si todavía no se ha realizado una búsqueda', async () => {
    await notify();
    expect(getCondenados).not.toHaveBeenCalled();
    expect(container.querySelector('.loading-overlay')).toBeNull();
  });

  it('mantiene el uso de la caché al cambiar de página manualmente', async () => {
    await search();
    getCachedCondenados.mockReturnValueOnce(payload('Página en caché', '456', 2));
    const cached = deferred();
    getCondenados.mockReturnValueOnce(cached.promise);
    await click('Siguiente');
    expect(container.querySelector('.loading-overlay')).toBeNull();
    await act(async () => cached.resolve(payload('Página en caché', '456', 2)));
    expect(container.textContent).toContain('Página en caché');
  });

  it('no programa más consultas al abandonar la pantalla durante una actualización', async () => {
    await search();
    const update = deferred();
    getCondenados.mockReturnValueOnce(update.promise);
    await notify();
    await notify();
    await act(async () => root.unmount());
    await act(async () => update.resolve(payload('Respuesta tardía')));
    await notify();
    expect(getCondenados).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();
  });
});
