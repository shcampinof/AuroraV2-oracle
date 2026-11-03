// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsignacionDefensores from './AsignacionDefensores.jsx';
import {
  assignDefensorPpl,
  getCondenados,
  getCondenadosFilterOptions,
  getDefensoresCatalogo,
  unassignDefensorPpl,
  validatePagCedula,
} from '../services/api.js';

vi.mock('../services/api.js', () => ({
  assignDefensorPpl: vi.fn(),
  createDefensor: vi.fn(),
  getCondenados: vi.fn(),
  getCondenadosFilterOptions: vi.fn(),
  getDefensoresPpl: vi.fn(),
  getDefensoresCatalogo: vi.fn(),
  extractDefensoresCatalogo: vi.fn(),
  isQueuedResponse: () => false,
  unassignDefensorPpl: vi.fn(),
  validatePagCedula: vi.fn(),
}));

describe('reasignaciones consecutivas desde PAG', () => {
  let container;
  let root;
  let defensorActual;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    defensorActual = 'DEFENSOR INICIAL';
    getDefensoresCatalogo.mockResolvedValue([
      { id: '11', nombre: 'DEFENSOR INICIAL' },
      { id: '22', nombre: 'DEFENSOR SEGUNDO' },
      { id: '33', nombre: 'DEFENSOR TERCERO' },
    ]);
    getCondenadosFilterOptions.mockResolvedValue({});
    validatePagCedula.mockResolvedValue({ cedula: '99', nombre: 'PAG PRUEBA' });
    getCondenados.mockImplementation(async () => ({
      rows: [{ numeroIdentificacion: '123', nombreUsuario: 'USUARIO PRUEBA', defensorAsignado: defensorActual }],
      meta: { totalMatched: 1, totalPages: 1 },
    }));
    assignDefensorPpl.mockImplementation(async (_documentos, defensor) => {
      defensorActual = defensor;
      return { updated: 1 };
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<AsignacionDefensores />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function click(label) {
    const button = [...container.querySelectorAll('button')]
      .find((item) => item.textContent.trim() === label);
    expect(button).toBeDefined();
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
  }

  async function fill(placeholder, value) {
    const input = container.querySelector(`input[placeholder="${placeholder}"]`);
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it.each(['condenado', 'sindicado'])('permite reasignar tres veces el mismo %s sin salir del módulo', async (tipo) => {
    await act(async () => root.render(<AsignacionDefensores tipo={tipo} />));
    await click('Reasignación');
    await fill('Ingrese cedula de PAG', '99');
    await click('Validar PAG');
    await fill('Filtrar departamento', 'BOYACA');
    await click('Filtrar');

    const destinos = [
      ['DEFENSOR SEGUNDO', '22'],
      ['DEFENSOR TERCERO', '33'],
      ['DEFENSOR INICIAL', '11'],
    ];
    for (const [index, [nombre, cedula]] of destinos.entries()) {
      const checkbox = container.querySelector('input[aria-label="Seleccionar 123"]');
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(false);
      await act(async () => checkbox.click());
      await fill('Escriba para buscar defensor', nombre);
      await click('GUARDAR REASIGNACIÓN');
      expect(assignDefensorPpl).toHaveBeenNthCalledWith(index + 1, ['123'], nombre, {
        pagCedula: '99', defensorCedula: cedula,
      });
      expect(container.querySelector('tbody').textContent).toContain(nombre);
      expect(container.textContent).toContain('Se actualizaron 1 asignación(es) correctamente.');
      expect(getCondenados).toHaveBeenLastCalledWith(expect.objectContaining({
        tipo,
        filters: expect.objectContaining({ asignacionEstado: 'con_defensor' }),
      }));
    }
    expect(window.confirm).toHaveBeenCalledTimes(3);
  });
  it('DNDP accede y reasigna sin validar una cédula PAG', async () => {
    await act(async () => root.render(<AsignacionDefensores user={{ roles: ['Aurora.DNDP'] }} />));
    expect(container.querySelector('input[placeholder="Ingrese cedula de PAG"]')).toBeNull();
    expect(container.textContent).toContain('Acceso DNDP');
    await click('Reasignación');
    await fill('Filtrar departamento', 'BOYACA');
    await click('Filtrar');
    await act(async () => container.querySelector('input[aria-label="Seleccionar 123"]').click());
    await fill('Escriba para buscar defensor', 'DEFENSOR SEGUNDO');
    await click('GUARDAR REASIGNACIÓN');
    expect(validatePagCedula).not.toHaveBeenCalled();
    expect(assignDefensorPpl).toHaveBeenCalledWith(['123'], 'DEFENSOR SEGUNDO', { defensorCedula: '22' });
    expect(container.querySelector('tbody').textContent).toContain('DEFENSOR SEGUNDO');
  });
  it('DNDP puede retirar asignaciones sin enviar cédula PAG', async () => {
    unassignDefensorPpl.mockResolvedValue({ updated: 1 });
    await act(async () => root.render(<AsignacionDefensores user={{ roles: ['dndp'] }} />));
    await click('Eliminar asignaciones');
    await fill('Filtrar departamento', 'BOYACA');
    await click('Filtrar');
    await act(async () => container.querySelector('input[aria-label="Seleccionar 123"]').click());
    const remove = [...container.querySelectorAll('button')].find((item) => item.textContent.trim().startsWith('ELIMINAR ASIGNACIONES'));
    expect(remove).toBeDefined();
    await act(async () => remove.click());
    expect(unassignDefensorPpl).toHaveBeenCalledWith(['123'], {});
    expect(validatePagCedula).not.toHaveBeenCalled();
  });
});
