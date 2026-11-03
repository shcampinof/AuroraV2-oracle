// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUsuarios from './AdminUsuarios.jsx';
import AdminCargasBD from './AdminCargasBD.jsx';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  deleteAdminUser: vi.fn(), getAdminUsers: vi.fn(), getPagRegionales: vi.fn(), importAdminUsersCsv: vi.fn(), previewAdminUsersCsv: vi.fn(),
  saveAdminUser: vi.fn(), updateAdminUser: vi.fn(), deleteActuacionesCleanup: vi.fn(), getActuacionesCleanupPreview: vi.fn(),
  getCargaBdLog: vi.fn(), getCargaBdSources: vi.fn(), getCargasBd: vi.fn(), retryCargaBd: vi.fn(), uploadCargaBd: vi.fn(),
}));

describe('administración de PAG y actuaciones de prueba', () => {
  let container;
  let root;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.getAdminUsers.mockResolvedValue({ users: [] });
    api.getPagRegionales.mockResolvedValue({ regionales: ['BOYACA', 'CUNDINAMARCA', 'META', 'NARIÑO'] });
    api.getCargaBdSources.mockResolvedValue({ fuentes: [] });
    api.getCargasBd.mockResolvedValue({ cargas: [] });
    api.deleteActuacionesCleanup.mockResolvedValue({ message: 'Eliminadas' });
    api.getActuacionesCleanupPreview.mockImplementation(async (_defensor, { offset }) => ({ preview: {
      defensor: 'PRUEBA PILOTO', totalActuaciones: 501, totalAsignaciones: 3,
      confirmation: 'ELIMINAR 501 ACTUACIONES Y 3 ASIGNACIONES', offset, truncated: !offset,
      actuaciones: [{ ID_GESTION: offset ? 20 : 10, DOCUMENTO: '123', NOMBRE: 'Prueba' }],
    } }));
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
  const button = (text) => [...container.querySelectorAll('button')].find((item) => item.textContent.trim() === text);
  const input = (text) => {
    const scope = container.querySelector('[role="dialog"]') || container;
    const label = [...scope.querySelectorAll('label')].find((item) => item.textContent.trim() === text);
    return label?.control || label?.querySelector('input');
  };
  async function click(element) {
    expect(element).toBeTruthy();
    expect(element.disabled).not.toBe(true);
    await act(async () => element.click());
  }
  async function fill(element, value) {
    expect(element).toBeTruthy();
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  async function key(element, value) {
    await act(async () => element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })));
  }
  it('guarda correo y cédula al crear un PAG', async () => {
    await act(async () => root.render(<AdminUsuarios />));
    await fill(input('Correo'), 'pag@defensoria.gov.co');
    await fill(input('Nombre'), 'Nuevo PAG');
    await click(input('PAG'));
    await fill(input('Cédula PAG'), '123456');
    await fill(input('Regional PAG'), 'META');
    await click(button('Guardar PAG'));
    expect(api.saveAdminUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'pag@defensoria.gov.co', name: 'Nuevo PAG', pagCedula: '123456', pagRegional: 'META', roles: ['user', 'pag'],
    }));
  });
  it('abre edición al habilitar PAG y permite completar la cédula de un usuario existente', async () => {
    api.getAdminUsers.mockResolvedValue({ users: [{ id: 'u1', email: 'pag@defensoria.gov.co', roles: ['user'], name: 'PAG' }] });
    await act(async () => root.render(<AdminUsuarios />));
    await click(button('Habilitar PAG'));
    expect(api.updateAdminUser).not.toHaveBeenCalled();
    await fill(input('Cédula PAG'), '123456');
    await fill(input('Regional PAG'), 'META');
    await click(button('Guardar PAG'));
    expect(api.updateAdminUser).toHaveBeenCalledWith('u1', expect.objectContaining({ pagCedula: '123456', roles: ['user', 'pag'] }));
  });
  it('filtra con cu y selecciona Cundinamarca con el teclado sin enviar el formulario', async () => {
    await act(async () => root.render(<AdminUsuarios />));
    await click(input('PAG'));
    const regional = input('Regional PAG');
    await act(async () => regional.focus());
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(4);
    await fill(regional, 'cu');
    expect([...container.querySelectorAll('[role="option"]')].map((item) => item.textContent)).toEqual(['CUNDINAMARCA']);
    await key(regional, 'ArrowDown');
    expect(document.getElementById(regional.getAttribute('aria-activedescendant')).textContent).toBe('CUNDINAMARCA');
    await key(regional, 'Enter');
    expect(regional.value).toBe('CUNDINAMARCA');
    expect(regional.getAttribute('aria-expanded')).toBe('false');
    expect(api.saveAdminUser).not.toHaveBeenCalled();
    await key(regional, 'ArrowDown');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(4);
    await key(regional, 'Escape');
    expect(regional.getAttribute('aria-expanded')).toBe('false');
  });
  it('busca sin tildes, permite elegir con el ratón y rechaza regionales que no existen', async () => {
    await act(async () => root.render(<AdminUsuarios />));
    await fill(input('Correo'), 'pag@defensoria.gov.co');
    await fill(input('Nombre'), 'Nuevo PAG');
    await click(input('PAG'));
    await fill(input('Cédula PAG'), '123456');
    const regional = input('Regional PAG');
    await fill(regional, 'narino');
    const option = container.querySelector('[role="option"]');
    expect(option.textContent).toBe('NARIÑO');
    await click(option);
    expect(regional.value).toBe('NARIÑO');
    await fill(regional, 'REGIONAL INVENTADA');
    expect(container.querySelector('[role="status"]').textContent).toContain('No hay regionales');
    await click(button('Guardar PAG'));
    expect(api.saveAdminUser).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Seleccione una regional PAG de la lista');
  });
  it('permite reintentar si falla la carga del catálogo sin perder los usuarios', async () => {
    api.getPagRegionales.mockRejectedValueOnce(new Error('Catálogo no disponible'));
    await act(async () => root.render(<AdminUsuarios />));
    await click(input('PAG'));
    expect(input('Regional PAG').disabled).toBe(true);
    expect(button('Guardar PAG').disabled).toBe(true);
    await click(button('Reintentar'));
    expect(input('Regional PAG').disabled).toBe(false);
    await fill(input('Regional PAG'), 'cu');
    expect(container.querySelector('[role="option"]').textContent).toBe('CUNDINAMARCA');
  });
  it('permite crear un usuario DNDP sin cédula ni regional y sin depender del catálogo PAG', async () => {
    api.getPagRegionales.mockRejectedValueOnce(new Error('Catálogo no disponible'));
    await act(async () => root.render(<AdminUsuarios />));
    await fill(input('Correo'), 'dndp@defensoria.gov.co');
    await click(input('DNDP'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(input('Cédula PAG')).toBeUndefined();
    await click(button('Guardar usuario'));
    expect(api.saveAdminUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'dndp@defensoria.gov.co', roles: ['user', 'dndp'], pagCedula: '', pagRegional: '',
    }));
  });
  it('cancelar el formulario emergente no habilita PAG ni guarda cambios', async () => {
    await act(async () => root.render(<AdminUsuarios />));
    await click(input('PAG'));
    expect(container.querySelector('[role="dialog"]').textContent).toContain('Registrar usuario como PAG');
    await fill(input('Cédula PAG'), '123456');
    await click(button('Cancelar'));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(input('PAG').checked).toBe(false);
    expect(api.saveAdminUser).not.toHaveBeenCalled();
    expect(api.updateAdminUser).not.toHaveBeenCalled();
  });
  it('un error al habilitar PAG conserva los datos en la ventana para corregirlos', async () => {
    api.getAdminUsers.mockResolvedValue({ users: [{ id: 'u1', email: 'pag@defensoria.gov.co', roles: ['user'], name: 'PAG' }] });
    api.updateAdminUser.mockRejectedValueOnce(new Error('Cédula asociada a otro correo'));
    await act(async () => root.render(<AdminUsuarios />));
    await click(button('Habilitar PAG'));
    expect(input('Correo').value).toBe('pag@defensoria.gov.co');
    await fill(input('Cédula PAG'), '123456');
    await fill(input('Regional PAG'), 'META');
    await click(button('Guardar PAG'));
    expect(container.querySelector('[role="dialog"]').textContent).toContain('Cédula asociada a otro correo');
    expect(input('Cédula PAG').value).toBe('123456');
    expect(button('Guardar PAG').disabled).toBe(false);
  });
  it('conserva selección entre páginas y elimina solo los IDs elegidos sin retirar asignaciones', async () => {
    await act(async () => root.render(<AdminCargasBD />));
    await click(button('Depurar actuaciones'));
    await click(container.querySelectorAll('input[name="cleanup-mode"]')[1]);
    expect(button('Eliminar 0 actuaciones seleccionadas').disabled).toBe(true);
    await click(container.querySelector('input[aria-label="Seleccionar actuación 10"]'));
    await fill(container.querySelector('.admin-cleanup-confirmation input'), 'ELIMINAR 1 ACTUACIONES');
    await click(button('Página siguiente'));
    expect(container.querySelector('.admin-cleanup-confirmation input').value).toBe('');
    await click(container.querySelector('input[aria-label="Seleccionar actuación 20"]'));
    await click(button('Página anterior'));
    expect(container.querySelector('input[aria-label="Seleccionar actuación 10"]').checked).toBe(true);
    await fill(container.querySelector('.admin-cleanup-confirmation input'), 'ELIMINAR 2 ACTUACIONES');
    await click(button('Eliminar 2 actuaciones seleccionadas'));
    expect(api.deleteActuacionesCleanup).toHaveBeenCalledWith({
      defensor: 'PRUEBA PILOTO', expectedCount: 2, expectedAssignments: 0, confirmation: 'ELIMINAR 2 ACTUACIONES',
      mode: 'selected', gestionIds: [10, 20],
    });
  });
  it('mantiene la depuración completa con su confirmación y elimina la selección al actualizar', async () => {
    await act(async () => root.render(<AdminCargasBD />));
    await click(button('Depurar actuaciones'));
    await click(container.querySelectorAll('input[name="cleanup-mode"]')[1]);
    await click(container.querySelector('input[aria-label="Seleccionar actuación 10"]'));
    await click(button('Actualizar vista previa'));
    expect(container.querySelector('input[aria-label="Seleccionar actuación 10"]').checked).toBe(false);
    await click(container.querySelectorAll('input[name="cleanup-mode"]')[0]);
    await fill(container.querySelector('.admin-cleanup-confirmation input'), 'ELIMINAR 501 ACTUACIONES Y 3 ASIGNACIONES');
    await click(button('Depurar 3 usuarios'));
    expect(api.deleteActuacionesCleanup).toHaveBeenCalledWith({
      defensor: 'PRUEBA PILOTO', expectedCount: 501, expectedAssignments: 3,
      confirmation: 'ELIMINAR 501 ACTUACIONES Y 3 ASIGNACIONES', mode: 'all',
    });
  });
});
