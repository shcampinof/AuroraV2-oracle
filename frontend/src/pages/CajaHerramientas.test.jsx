// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CajaHerramientas from './CajaHerramientas.jsx';
import { getFormatos, getFormatoDownloadTarget, guardarFormato, getCarpetasHerramientas, guardarCarpetaHerramientas, eliminarCarpetaHerramientas } from '../services/api.js';

vi.mock('../services/api.js', () => ({
  getFormatos: vi.fn(), getFormatoDownloadTarget: vi.fn(), guardarFormato: vi.fn(),
  getCarpetasHerramientas: vi.fn(), guardarCarpetaHerramientas: vi.fn(), eliminarCarpetaHerramientas: vi.fn(),
}));

const item = { id: 'f3', titulo: 'Formato existente', color: '#c23b73', categoria: 'utilidad-publica', sourceUrl: 'https://tenant.sharepoint.com/archivo?e=abc', downloadUrl: 'https://tenant.sharepoint.com/archivo?e=abc&download=1' };

describe('edición de la caja de herramientas', () => {
  let container;
  let root;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    getFormatos.mockResolvedValue([{ ...item }]);
    getCarpetasHerramientas.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function render(puedeEditar = true) {
    await act(async () => root.render(<CajaHerramientas puedeEditar={puedeEditar} />));
  }
  async function click(text) {
    const button = [...container.querySelectorAll('button')].find((el) => el.textContent === text);
    expect(button).toBeDefined();
    await act(async () => button.click());
  }
  async function input(id, value) {
    const element = container.querySelector(`#${id}`);
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  async function submit() {
    await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  }

  async function selectCarpeta(id) {
    await act(async () => {
      const select = container.querySelector('#formato-carpeta');
      select.value = id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async function clickLabel(label) {
    const button = [...container.querySelectorAll('button')].find((el) => el.getAttribute('aria-label') === label);
    expect(button).toBeDefined();
    await act(async () => button.click());
  }

  it('permite descargar sin mostrar los controles administrativos al lector', async () => {
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    getFormatoDownloadTarget.mockResolvedValue({ downloadUrl: item.downloadUrl });
    await render(false);
    expect(container.textContent).not.toContain('Editar caja');
    expect(container.querySelector('.tool-edit')).toBeNull();
    await click('Descargar');
    expect(getFormatoDownloadTarget).toHaveBeenCalledWith('f3');
    expect(anchor).toHaveBeenCalledOnce();
  });

  it('previsualiza la URL, añade el ítem y lo muestra con el color guardado', async () => {
    await render();
    await click('Editar caja de herramientas');
    await input('formato-titulo', 'Nuevo formato');
    await act(async () => container.querySelector('input[name="formato-color"][value="#167d55"]').click());
    await input('formato-url', 'https://tenant.sharepoint.com/nuevo?e=abc&web=1');
    expect(container.querySelector('output').textContent).toBe('https://tenant.sharepoint.com/nuevo?e=abc&download=1');
    guardarFormato.mockImplementation(async (data) => ({ id: 'nuevo', ...data, downloadUrl: container.querySelector('output').textContent }));
    await submit();
    expect(guardarFormato).toHaveBeenCalledWith({ titulo: 'Nuevo formato', color: '#167d55', sourceUrl: 'https://tenant.sharepoint.com/nuevo?e=abc&web=1', carpetaId: null }, undefined);
    expect(container.querySelectorAll('.tool-card')).toHaveLength(2);
    const card = [...container.querySelectorAll('.tool-card')][1];
    expect(card.style.getPropertyValue('--tool-accent')).toBe('#167d55');
    expect(card.style.getPropertyValue('--tool-action-text')).toBe('#ffffff');
    expect(container.querySelector('[role="status"]').textContent).toContain('añadido');
    await click('Nuevo ítem');
    expect(container.querySelector('#formato-titulo').value).toBe('');
  });

  it('carga el ítem existente y actualiza su enlace sin duplicarlo', async () => {
    await render();
    await click('Editar caja de herramientas');
    await click('Editar');
    expect(container.querySelector('#formato-titulo').value).toBe(item.titulo);
    expect(container.querySelector('input[name="formato-color"]:checked').value).toBe(item.color);
    expect(container.querySelector('#formato-url').value).toBe(item.sourceUrl);
    await input('formato-url', 'https://example.org/actualizado.docx');
    guardarFormato.mockImplementation(async (data) => ({ ...item, ...data, downloadUrl: data.sourceUrl }));
    await submit();
    expect(guardarFormato).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: 'https://example.org/actualizado.docx' }), 'f3');
    expect(container.querySelectorAll('.tool-card')).toHaveLength(1);
    expect(container.querySelector('[role="status"]').textContent).toContain('actualizado');
    await click('Terminar edición');
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('.tool-edit')).toBeNull();
  });

  it('bloquea enlaces inválidos y conserva lo escrito si el servidor rechaza el guardado', async () => {
    await render();
    await click('Editar caja de herramientas');
    await input('formato-titulo', 'Nuevo formato');
    await input('formato-url', 'javascript:alert(1)');
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(container.querySelector('output')).toBeNull();
    await input('formato-url', 'https://example.org/formato.pdf');
    guardarFormato.mockRejectedValue(new Error('No tiene permisos para acceder a este recurso.'));
    await submit();
    expect(container.querySelector('[role="alert"]').textContent).toContain('No tiene permisos');
    expect(container.querySelector('#formato-titulo').value).toBe('Nuevo formato');
    expect(container.querySelectorAll('.tool-card')).toHaveLength(1);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('ofrece exactamente cinco colores y permite elegir cada uno sin selector RGB', async () => {
    await render();
    await click('Editar caja de herramientas');
    const options = [...container.querySelectorAll('input[name="formato-color"]')];
    expect(options).toHaveLength(5);
    expect(options.map((option) => option.closest('label').textContent)).toEqual(['Azul', 'Rosa', 'Verde', 'Morado', 'Naranja']);
    expect(container.querySelector('input[type="color"]')).toBeNull();
    expect(options.find((option) => option.checked).value).toBe('#2563a6');
    for (const option of options) {
      await act(async () => option.click());
      expect(container.querySelector('input[name="formato-color"]:checked').value).toBe(option.value);
    }
  });

  it('un color anterior fuera de la paleta no añade una sexta opción', async () => {
    getFormatos.mockResolvedValue([{ ...item, color: '#ffffff' }]);
    await render();
    await click('Editar caja de herramientas');
    await click('Editar');
    expect(container.querySelectorAll('input[name="formato-color"]')).toHaveLength(5);
    expect(container.querySelector('input[name="formato-color"]:checked').value).toBe('#c23b73');
  });

  it('deshabilita el formulario mientras guarda y oculta el editor si se revocan los permisos', async () => {
    await render();
    await click('Editar caja de herramientas');
    await input('formato-titulo', 'Nuevo');
    await input('formato-url', 'https://example.org/formato.pdf');
    let resolve;
    guardarFormato.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await submit();
    expect(container.querySelector('fieldset').disabled).toBe(true);
    expect(container.querySelector('button[type="submit"]').textContent).toBe('Guardando...');
    await act(async () => resolve({ ...item, id: 'nuevo', titulo: 'Nuevo' }));
    await render(false);
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('.tool-edit')).toBeNull();
  });

  it('permite al lector abrir carpetas, descargar y volver a los ítems sin carpeta', async () => {
    const carpeta = { id: 'c1', nombre: 'Solicitudes' };
    getCarpetasHerramientas.mockResolvedValue([carpeta, { id: 'c2', nombre: 'Vacía' }]);
    getFormatos.mockResolvedValue([{ ...item, carpetaId: 'c1' }, { ...item, id: 'f4', titulo: 'Documento sin carpeta' }]);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    getFormatoDownloadTarget.mockResolvedValue({ downloadUrl: item.downloadUrl });
    await render(false);
    expect(container.querySelectorAll('.tools-folder-card')).toHaveLength(2);
    expect(container.querySelectorAll('.tool-card')).toHaveLength(1);
    expect(container.querySelector('.tool-title').textContent).toBe('Documento sin carpeta');
    expect(container.querySelector('.tools-folder-card').textContent).toContain('1 ítem');
    await clickLabel('Abrir carpeta Solicitudes');
    expect(container.querySelector('[aria-current="page"]').textContent).toBe('Solicitudes');
    expect(container.querySelector('.tool-title').textContent).toBe(item.titulo);
    expect(container.textContent).not.toContain('Editar carpeta');
    await click('Descargar');
    expect(getFormatoDownloadTarget).toHaveBeenCalledWith(item.id);
    await click('Caja de herramientas');
    await clickLabel('Abrir carpeta Vacía');
    expect(container.textContent).toContain('Esta carpeta aún no tiene formularios ni documentos.');
  });

  it('crea una carpeta agrupando documentos y permite añadir nuevos ítems dentro', async () => {
    const carpeta = { id: 'c1', nombre: 'Solicitudes' };
    guardarCarpetaHerramientas.mockResolvedValue({ carpeta, carpetas: [carpeta], formatos: [{ ...item, carpetaId: 'c1' }] });
    await render();
    await click('Editar caja de herramientas');
    await click('Nueva carpeta');
    await input('carpeta-nombre', 'Solicitudes');
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    await submit();
    expect(guardarCarpetaHerramientas).toHaveBeenCalledWith({ nombre: 'Solicitudes', formatoIds: ['f3'] }, undefined);
    expect(container.querySelector('[role="status"]').textContent).toContain('creada');
    expect(container.querySelector('.tool-title').textContent).toBe(item.titulo);
    await click('Nuevo ítem');
    expect(container.querySelector('#formato-carpeta').value).toBe('c1');
    await input('formato-titulo', 'Otro documento');
    await input('formato-url', 'https://example.org/doc.pdf');
    guardarFormato.mockImplementation(async (data) => ({ ...data, id: 'f4' }));
    await submit();
    expect(guardarFormato).toHaveBeenCalledWith(expect.objectContaining({ carpetaId: 'c1' }), undefined);
    expect(container.querySelectorAll('.tool-card')).toHaveLength(2);
  });

  it('renombra carpetas y permite seleccionar ítems de otra carpeta o desagruparlos', async () => {
    const carpeta = { id: 'c1', nombre: 'Original' };
    const otra = { id: 'c2', nombre: 'Otra' };
    getCarpetasHerramientas.mockResolvedValue([carpeta, otra]);
    getFormatos.mockResolvedValue([{ ...item, carpetaId: 'c1' }, { ...item, id: 'f4', titulo: 'Otro', carpetaId: 'c2' }]);
    guardarCarpetaHerramientas.mockResolvedValue({
      carpeta: { ...carpeta, nombre: 'Actualizada' }, carpetas: [{ ...carpeta, nombre: 'Actualizada' }, otra],
      formatos: [{ ...item, carpetaId: null }, { ...item, id: 'f4', titulo: 'Otro', carpetaId: 'c1' }],
    });
    await render();
    await click('Editar caja de herramientas');
    await clickLabel('Editar carpeta Original');
    expect(container.querySelector('#carpeta-nombre').value).toBe('Original');
    const checks = [...container.querySelectorAll('input[type="checkbox"]')];
    expect(checks.map((check) => check.checked)).toEqual([true, false]);
    await act(async () => { checks[0].click(); checks[1].click(); });
    await input('carpeta-nombre', 'Actualizada');
    await submit();
    expect(guardarCarpetaHerramientas).toHaveBeenCalledWith({ nombre: 'Actualizada', formatoIds: ['f4'] }, 'c1');
    expect(container.querySelector('[aria-current="page"]').textContent).toBe('Actualizada');
    expect(container.querySelector('.tool-title').textContent).toBe('Otro');
    await click('Caja de herramientas');
    expect(container.querySelector('.tool-title').textContent).toBe(item.titulo);
  });

  it('mueve un ítem a una carpeta y permite retirarlo desde su editor', async () => {
    getCarpetasHerramientas.mockResolvedValue([{ id: 'c1', nombre: 'Solicitudes' }]);
    guardarFormato.mockImplementation(async (data) => ({ ...item, ...data }));
    await render();
    await click('Editar caja de herramientas');
    await click('Editar');
    await selectCarpeta('c1');
    await submit();
    expect(guardarFormato).toHaveBeenLastCalledWith(expect.objectContaining({ carpetaId: 'c1' }), item.id);
    expect(container.querySelector('[aria-current="page"]').textContent).toBe('Solicitudes');
    await selectCarpeta('');
    await submit();
    expect(guardarFormato).toHaveBeenLastCalledWith(expect.objectContaining({ carpetaId: null }), item.id);
    expect(container.querySelector('[aria-current="page"]')).toBeNull();
    expect(container.querySelectorAll('.tool-card')).toHaveLength(1);
  });

  it('elimina una carpeta tras confirmar y conserva sus documentos sin carpeta', async () => {
    getCarpetasHerramientas.mockResolvedValue([{ id: 'c1', nombre: 'Solicitudes' }]);
    getFormatos.mockResolvedValue([{ ...item, carpetaId: 'c1' }]);
    eliminarCarpetaHerramientas.mockResolvedValue({ carpetas: [], formatos: [{ ...item, carpetaId: null }] });
    await render();
    await click('Editar caja de herramientas');
    await clickLabel('Editar carpeta Solicitudes');
    await click('Eliminar carpeta');
    expect(eliminarCarpetaHerramientas).not.toHaveBeenCalled();
    await click('Cancelar');
    expect(container.textContent).not.toContain('Eliminar y conservar ítems');
    await click('Eliminar carpeta');
    await click('Eliminar y conservar ítems');
    expect(eliminarCarpetaHerramientas).toHaveBeenCalledWith('c1');
    expect(container.querySelectorAll('.tools-folder-card')).toHaveLength(0);
    expect(container.querySelector('.tool-title').textContent).toBe(item.titulo);
    expect(container.querySelector('[role="status"]').textContent).toContain('se conservaron');
  });

  it('conserva la selección y el nombre cuando falla el guardado de una carpeta', async () => {
    guardarCarpetaHerramientas.mockRejectedValue(new Error('Ya existe una carpeta con ese nombre.'));
    await render();
    await click('Editar caja de herramientas');
    await click('Nueva carpeta');
    await input('carpeta-nombre', 'Solicitudes');
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    await submit();
    expect(container.querySelector('[role="alert"]').textContent).toContain('Ya existe');
    expect(container.querySelector('#carpeta-nombre').value).toBe('Solicitudes');
    expect(container.querySelector('input[type="checkbox"]').checked).toBe(true);
    expect(container.querySelectorAll('.tool-card')).toHaveLength(1);
  });

  it('no habilita la edición si no se pueden cargar las carpetas', async () => {
    getCarpetasHerramientas.mockRejectedValue(new Error('Sin conexión'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await render();
    expect(container.textContent).toContain('Error cargando formatos');
    expect(container.textContent).not.toContain('Editar caja de herramientas');
  });
});
