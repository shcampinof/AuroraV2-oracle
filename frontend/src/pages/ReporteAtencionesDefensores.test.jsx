// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReporteAtencionesDefensores from './ReporteAtencionesDefensores.jsx';
import { getReporteAtencionesDefensores, getReporteAtencionesOpciones } from '../services/api.js';

vi.mock('../services/api.js', () => ({
  getReporteAtencionesDefensores: vi.fn(),
  getReporteAtencionesOpciones: vi.fn(),
}));

describe('alcance del reporte de gestión', () => {
  let container;
  let root;
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    getReporteAtencionesOpciones.mockResolvedValue({
      defensores: [
        { id: '1', nombre: 'DEFENSOR PRUEBA', regional: 'QUINDIO', regionalesCasos: ['CUNDINAMARCA'] },
        { id: '2', nombre: 'DEFENSOR QUINDIO', regional: 'CUNDINAMARCA', regionalesCasos: ['QUINDIO'], tieneCasosSindicados: true },
      ],
      regionales: ['CUNDINAMARCA', 'QUINDIO', 'AMAZONAS', 'Sin regional identificada'],
      establecimientosRegionales: [
        { nombre: 'CPMS GIRARDOT', regional: 'CUNDINAMARCA' },
        { nombre: 'CPMS ARMENIA', regional: 'QUINDIO' },
      ],
    });
    getReporteAtencionesDefensores.mockResolvedValue(null);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ReporteAtencionesDefensores user={{ name: 'DEFENSOR PRUEBA' }} />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  function inputFor(label) {
    return [...container.querySelectorAll('label')].find((item) => item.textContent.includes(label)).querySelector('input, select');
  }
  async function fill(label, value) {
    const input = inputFor(label);
    await act(async () => {
      const prototype = input.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
  }
  async function submit() {
    await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  }
  it('envía establecimiento y fechas con ambos tipos de caso sin mostrar el filtro de tipo', async () => {
    expect(container.textContent).not.toContain('Tipo de caso');
    await fill('Establecimiento', 'CPMS GIRARDOT');
    await fill('Fecha inicio', '2025-01-01');
    await fill('Fecha final', '2026-10-19');
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenCalledWith(expect.objectContaining({
      defensorId: '1', tipo: 'all', lugar: 'CPMS GIRARDOT', incluirFueraPrision: true,
      fechaInicio: '2025-01-01', fechaFin: '2026-10-19',
    }));
  });
  it('incluye personas fuera de prisión por defecto y permite desmarcar la opción', async () => {
    const checkbox = inputFor('Incluir personas');
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(false);
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenLastCalledWith(expect.objectContaining({ incluirFueraPrision: true, tipo: 'all' }));
    await act(async () => checkbox.click());
    expect(checkbox.checked).toBe(false);
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenLastCalledWith(expect.objectContaining({ incluirFueraPrision: false, tipo: 'all' }));
    await act(async () => checkbox.click());
    expect(checkbox.checked).toBe(true);
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenLastCalledWith(expect.objectContaining({ incluirFueraPrision: true, tipo: 'all' }));
  });
  it('filtra por la regional de los casos y limpia selecciones al cambiar de regional', async () => {
    const options = (id) => [...container.querySelectorAll(`#${id} option`)].map((item) => item.value);
    expect(inputFor('Defensoría Regional').value).toBe('CUNDINAMARCA');
    expect(options('reporte-defensores-list')).toEqual(['DEFENSOR PRUEBA']);
    expect(options('reporte-establecimientos-list')).toEqual(['CPMS GIRARDOT']);
    await fill('Establecimiento', 'CPMS GIRARDOT');
    await fill('Defensoría Regional', 'QUINDIO');
    expect(inputFor('Establecimiento').value).toBe('');
    expect(inputFor('Defensor(a)').value).toBe('');
    expect(options('reporte-defensores-list')).toEqual(['DEFENSOR QUINDIO']);
    expect(options('reporte-establecimientos-list')).toEqual(['CPMS ARMENIA']);
    await submit();
    expect(getReporteAtencionesDefensores).not.toHaveBeenCalled();
    await fill('Defensor(a)', 'DEFENSOR QUINDIO');
    await fill('Establecimiento', 'CPMS ARMENIA');
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenLastCalledWith(expect.objectContaining({
      regional: 'QUINDIO', defensorId: '2', lugar: 'CPMS ARMENIA',
    }));
    await fill('Defensoría Regional', 'AMAZONAS');
    expect(options('reporte-defensores-list')).toEqual([]);
    expect(options('reporte-establecimientos-list')).toEqual([]);
    expect(container.textContent).toContain('No hay defensores con casos registrados en la regional seleccionada.');
    await fill('Defensoría Regional', '');
    expect(inputFor('Establecimiento').disabled).toBe(true);
    expect(inputFor('Defensor(a)').disabled).toBe(true);
  });
  it('rechaza un establecimiento ajeno a la regional aunque se escriba manualmente', async () => {
    await fill('Establecimiento', 'CPMS ARMENIA');
    await submit();
    expect(getReporteAtencionesDefensores).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Seleccione un ERON de las sugerencias de esta regional.');
  });
  it('ofrece los defensores con casos sin regional únicamente en la consulta separada', async () => {
    const original = await getReporteAtencionesOpciones.mock.results[0].value;
    getReporteAtencionesOpciones.mockResolvedValue({
      ...original,
      defensores: [...original.defensores, {
        id: '3', nombre: 'DEFENSOR SINDICADOS', regionalesCasos: ['Sin regional identificada'], tieneCasosSindicados: true,
      }],
    });
    await act(async () => root.render(<ReporteAtencionesDefensores user={{ name: 'DEFENSOR PRUEBA' }} />));
    const names = () => [...container.querySelectorAll('#reporte-defensores-list option')].map((option) => option.value);
    expect(names()).toEqual(['DEFENSOR PRUEBA']);
    await fill('Defensoría Regional', 'Sin regional identificada');
    expect(names()).toEqual(['DEFENSOR SINDICADOS']);
    expect(inputFor('Establecimiento').disabled).toBe(true);
    await fill('Defensor(a)', 'DEFENSOR SINDICADOS');
    await submit();
    expect(getReporteAtencionesDefensores).toHaveBeenLastCalledWith(expect.objectContaining({
      defensorId: '3', regional: 'Sin regional identificada', lugar: '',
    }));
    await fill('Defensoría Regional', 'QUINDIO');
    expect(inputFor('Defensor(a)').value).toBe('');
    expect(names()).toEqual(['DEFENSOR QUINDIO']);
    await fill('Defensoría Regional', 'CUNDINAMARCA');
    expect(names()).toEqual(['DEFENSOR PRUEBA']);
  });
  it('mantiene los totales globales independientes del periodo', async () => {
    getReporteAtencionesDefensores.mockImplementation(async (filters) => ({
      metadata: { ...filters, defensor: 'DEFENSOR PRUEBA' },
      resumen: {
        casosAnalizados: filters.fechaInicio === '2025-01-01' ? 10 : 0,
        entrevistasRealizadas: 0, solicitudesPresentadas: 0, reiteracionesPresentadas: 0,
        recursosPresentados: 0, casosCerrados: 0,
        personasAsignadas: 319, personasActivas: 42,
        personasActivasConGestion: filters.fechaInicio === '2025-01-01' ? 30 : 2,
        totalPersonasConCasosCerrados: 277,
      },
    }));
    await fill('Fecha inicio', '2025-01-01');
    await fill('Fecha final', '2026-10-27');
    await submit();
    const checkGlobalCards = () => {
      const group = container.querySelector('[aria-label="Totales globales actuales"]');
      expect(group.textContent).not.toContain('Sin filtro de fechas');
      expect([...group.querySelectorAll('article')].map((card) => card.textContent)).toEqual([
        'Total personas con caso activo42', 'Total personas con casos cerrados277',
      ]);
      expect(group.textContent).not.toContain('Personas activas con gestión');
      expect(container.querySelector('.report-attentions-note')).toBeNull();
    };
    checkGlobalCards();
    expect(container.querySelector('.report-attentions-scope-note').textContent).toContain('asociados a la regional seleccionada');
    expect(container.querySelector('.report-attentions-period article strong').textContent).toBe('10');
    const managedCard = () => [...container.querySelectorAll('.report-attentions-period article')]
      .find(card => card.querySelector('span').textContent === 'Personas activas con gestión en el periodo');
    expect(managedCard().querySelector('strong').textContent).toBe('30');
    expect(container.querySelectorAll('.report-attentions-period article')).toHaveLength(8);
    await fill('Fecha inicio', '2026-10-01');
    await submit();
    checkGlobalCards();
    expect(container.querySelector('.report-attentions-period article strong').textContent).toBe('0');
    expect(managedCard().querySelector('strong').textContent).toBe('2');
    await fill('Establecimiento', 'CPMS GIRARDOT');
    await submit();
    expect(container.querySelector('.report-attentions-scope-note').textContent).toContain('asociados al ERON seleccionado');
  });
});
