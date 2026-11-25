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

  it.each(['BOYACÁ', '', null])('consulta casos y filtros con el PAG validado cuya regional es %s', async (regional) => {
    expect(getCondenadosFilterOptions).not.toHaveBeenCalled();
    validatePagCedula.mockResolvedValue({ cedula: '99', nombre: 'PAG PRUEBA', regional });
    await fill('Ingrese cedula de PAG', '99');
    await click('Validar PAG');
    expect(getCondenadosFilterOptions.mock.lastCall[0]).toMatchObject({ tipo: 'condenado', pagCedula: '99' });
    expect(container.textContent).toContain(regional ? 'Regional: BOYACÁ' : 'Sin regional definida: consulta de todas las regionales');
    expect(container.textContent).toContain(regional
      ? 'En esta pantalla se muestran únicamente los casos de su regional.'
      : 'No hay una regional definida para el PAG. Puede consultar casos de todas las regionales.');
    await fill('Ingrese nombre de la persona privada de la libertad', 'Usuario');
    await click('Filtrar');
    expect(getCondenados.mock.lastCall[0]).toMatchObject({ tipo: 'condenado', pagCedula: '99' });
    await fill('Ingrese cedula de PAG', '88');
    expect(container.querySelector('tbody')).toBeNull();
  });

  it.each(['Asignación', 'Reasignación', 'Eliminar asignaciones'])('permite gestionar los casos de la regional devueltos por el servidor en %s', async (tab) => {
    validatePagCedula.mockResolvedValue({ cedula: '99', nombre: 'PAG BOYACÁ', regional: 'BOYACÁ' });
    getCondenados.mockResolvedValue({
      rows: [
        { numeroIdentificacion: '123', nombreUsuario: 'CASO BOYACÁ', puedeAsignar: true },
      ],
      meta: { totalMatched: 1, totalPages: 1 },
    });
    await fill('Ingrese cedula de PAG', '99');
    await click('Validar PAG');
    await click(tab);
    await fill('Ingrese nombre de la persona privada de la libertad', 'CASO');
    await click('Filtrar');
    const table = container.querySelector('tbody');
    expect(table.textContent).toContain('CASO BOYACÁ');
    expect(table.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    const ownCheckbox = table.querySelector('input[type="checkbox"]');
    await act(async () => ownCheckbox.click());
    if (tab === 'Eliminar asignaciones') {
      unassignDefensorPpl.mockResolvedValue({ updated: 1 });
      await click('ELIMINAR ASIGNACIONES');
      expect(unassignDefensorPpl).toHaveBeenCalledWith(['123'], { pagCedula: '99' });
    } else {
      await fill('Escriba para buscar defensor', 'DEFENSOR SEGUNDO');
      await click(tab === 'Asignación' ? 'GUARDAR ASIGNACIÓN' : 'GUARDAR REASIGNACIÓN');
      expect(assignDefensorPpl).toHaveBeenCalledWith(['123'], 'DEFENSOR SEGUNDO', expect.any(Object));
    }
  });

  it.each(['', null])('muestra todas las regionales cuando el PAG no tiene regional definida (%s)', async (regional) => {
    validatePagCedula.mockResolvedValue({ cedula: '99', nombre: 'PAG SIN REGIONAL', regional });
    getCondenados.mockResolvedValue({
      rows: [
        { numeroIdentificacion: '123', nombreUsuario: 'CASO BOYACÁ', puedeAsignar: false },
        { numeroIdentificacion: '456', nombreUsuario: 'CASO META', puedeAsignar: false },
      ],
      meta: { totalMatched: 2, totalPages: 1 },
    });
    await fill('Ingrese cedula de PAG', '99');
    await click('Validar PAG');
    await fill('Ingrese nombre de la persona privada de la libertad', 'CASO');
    await click('Filtrar');
    const table = container.querySelector('tbody');
    expect(table.textContent).toContain('CASO BOYACÁ');
    expect(table.textContent).toContain('CASO META');
    expect(table.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.textContent).toContain('Puede consultar casos de todas las regionales.');
  });

  it.each([
    ['consulta'], ['Aurora.Consulta'],
  ])('permite consultar PAG con %s sin cédula ni acciones de modificación', async (role) => {
    await act(async () => root.render(<AsignacionDefensores user={{ roles: ['user', role, 'dndp', 'pag'] }} />));
    expect(container.textContent).toContain('Rol Consulta');
    expect(container.textContent).not.toContain('Validacion de PAG');
    expect(container.textContent).not.toContain('Crear defensor');
    expect(container.textContent).not.toContain('Eliminar asignaciones');
    expect(container.textContent).not.toContain('Nuevo defensor');
    await fill('Ingrese nombre de la persona privada de la libertad', 'Usuario');
    await click('Filtrar');
    expect(getCondenados.mock.lastCall[0].filters).toMatchObject({ nombre: 'Usuario', asignacionEstado: 'sin_defensor' });
    expect(container.querySelector('tbody').textContent).toContain('USUARIO PRUEBA');
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    await click('Casos con defensor');
    await fill('Filtrar defensor actual', 'DEFENSOR INICIAL');
    await click('Filtrar');
    expect(getCondenados.mock.lastCall[0].filters).toMatchObject({ defensor: 'DEFENSOR INICIAL', asignacionEstado: 'con_defensor' });
    expect(container.textContent).not.toContain('GUARDAR');
    expect(validatePagCedula).not.toHaveBeenCalled();
    expect(assignDefensorPpl).not.toHaveBeenCalled();
    expect(unassignDefensorPpl).not.toHaveBeenCalled();
  });

  it.each([
    ['Asignación', 'sin_defensor'],
    ['Reasignación', 'con_defensor'],
    ['Eliminar asignaciones', 'con_defensor'],
  ])('busca solo por nombre de la persona privada de la libertad y lo limpia en %s', async (tab, asignacionEstado) => {
    await fill('Ingrese cedula de PAG', '99');
    await click('Validar PAG');
    await click(tab);
    const fields = [...container.querySelectorAll('.filter-panel .form-field')];
    const nameIndex = fields.findIndex((field) => field.querySelector('label')?.textContent === 'Nombre persona privada de la libertad');
    expect(nameIndex).toBeGreaterThan(-1);
    expect(fields[nameIndex + 1].querySelector('label').textContent).toBe('Potenciales candidatos de solicitudes');

    await fill('Ingrese nombre de la persona privada de la libertad', '  María Pérez  ');
    await click('Filtrar');
    expect(getCondenados).toHaveBeenLastCalledWith(expect.objectContaining({
      tipo: 'condenado', page: 1,
      filters: expect.objectContaining({ nombre: 'María Pérez', asignacionEstado }),
    }));
    expect(container.textContent).toContain('María Pérez');

    await click('Limpiar filtros');
    expect(container.querySelector('#pag-nombre-ppl').value).toBe('');
    expect(container.textContent).not.toContain('Filtros aplicados:');
    const previousCalls = getCondenados.mock.calls.length;
    await click('Filtrar');
    expect(getCondenados).toHaveBeenCalledTimes(previousCalls);
    expect(container.textContent).toContain('Seleccione al menos un filtro');
    await fill('Filtrar departamento', 'BOYACA');
    await click('Filtrar');
    expect(getCondenados.mock.lastCall[0].filters).toMatchObject({ nombre: '', departamento: 'BOYACA' });
  });

  it('aplica nombre de la persona privada de la libertad con Enter, lo combina con otros filtros y conserva el nombre consultado al paginar', async () => {
    getCondenados.mockResolvedValue({ rows: [], meta: { totalMatched: 100, totalPages: 2 } });
    await fill('Ingrese cedula de PAG', '99');
    await click('Validar PAG');
    await fill('Filtrar departamento', 'BOYACA');
    await fill('Ingrese nombre de la persona privada de la libertad', 'Pérez');
    await act(async () => container.querySelector('#pag-nombre-ppl')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(getCondenados.mock.lastCall[0]).toMatchObject({
      page: 1, filters: { nombre: 'Pérez', departamento: 'BOYACA' },
    });
    await fill('Ingrese nombre de la persona privada de la libertad', 'Otro nombre sin aplicar');
    await click('Siguiente');
    expect(getCondenados.mock.lastCall[0]).toMatchObject({
      page: 2, filters: { nombre: 'Pérez', departamento: 'BOYACA' },
    });
  });

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
