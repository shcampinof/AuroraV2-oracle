// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConsultaCasePermissions from './ConsultaCasePermissions.jsx';
import { changeConsultaCases, getConsultaCases, searchConsultaCases } from '../services/api.js';

vi.mock('../services/api.js', () => ({ changeConsultaCases: vi.fn(), getConsultaCases: vi.fn(), searchConsultaCases: vi.fn() }));

describe('permisos de casos de colaboradores', () => {
  let container;
  let root;
  const users = [
    { id: 'c1', name: 'Estudiante', email: 'estudiante@example.test', roles: ['Aurora.Consulta'] },
    { id: 'd1', email: 'defensor@example.test', roles: ['user'] },
    { id: 'c2', email: 'inactivo@example.test', roles: ['consulta'], enabled: false },
  ];
  const record = { situacionId: '41', documento: '123', nombre: 'PPL de prueba', proceso: 'PROCESO 1', defensor: 'DEFENSORA' };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    getConsultaCases.mockResolvedValue({ cases: [] });
    searchConsultaCases.mockResolvedValue({ cases: [record], page: 1, hasMore: false });
    changeConsultaCases.mockResolvedValue({ ok: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const button = (label) => [...container.querySelectorAll('button')].find((item) => item.textContent === label);
  async function selectCollaborator() {
    await act(async () => {
      const select = container.querySelector('select');
      select.value = 'c1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  async function search() {
    await act(async () => {
      const input = container.querySelector('input[type="search"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '123');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Buscar casos').click());
  }

  it('selecciona solo colaboradores habilitados, autoriza y retira sin modificar al defensor', async () => {
    await act(async () => root.render(<ConsultaCasePermissions users={users} />));
    expect(container.querySelectorAll('option')).toHaveLength(2);
    await selectCollaborator();
    expect(getConsultaCases).toHaveBeenCalledWith('c1');
    await search();
    expect(searchConsultaCases).toHaveBeenCalledWith(expect.objectContaining({ documento: '123' }), 1);
    expect(container.textContent).toContain('DEFENSORA');
    await act(async () => container.querySelector('[aria-label="Autorizar caso 41"]').click());
    getConsultaCases.mockResolvedValue({ cases: [{ ...record, disponible: true }] });
    await act(async () => button('Autorizar edición (1)').click());
    expect(changeConsultaCases).toHaveBeenLastCalledWith('c1', 'grant', [record]);
    expect(container.querySelector('[aria-label="Autorizar caso 41"]').disabled).toBe(true);
    getConsultaCases.mockResolvedValue({ cases: [] });
    await act(async () => button('Retirar permiso').click());
    expect(changeConsultaCases).toHaveBeenLastCalledWith('c1', 'revoke', [expect.objectContaining({ situacionId: '41' })]);
    expect(container.textContent).toContain('El usuario de Consulta no tiene casos autorizados.');
  });

  it('muestra errores del servidor y conserva el permiso cuando falla su retiro', async () => {
    getConsultaCases.mockResolvedValue({ cases: [{ ...record, disponible: false }] });
    await act(async () => root.render(<ConsultaCasePermissions users={users} />));
    await selectCollaborator();
    expect(container.textContent).toContain('Solo lectura');
    changeConsultaCases.mockRejectedValue(new Error('No fue posible retirar el permiso'));
    await act(async () => button('Retirar permiso').click());
    expect(container.querySelector('[role="alert"]').textContent).toContain('No fue posible retirar');
    expect(button('Retirar permiso')).toBeTruthy();
  });

  it('conserva los filtros aplicados al paginar aunque se edite la búsqueda', async () => {
    searchConsultaCases.mockResolvedValue({ cases: [record], page: 1, hasMore: true });
    await act(async () => root.render(<ConsultaCasePermissions users={users} />));
    await selectCollaborator();
    await search();
    await act(async () => button('Siguiente').click());
    expect(searchConsultaCases).toHaveBeenLastCalledWith(expect.objectContaining({ documento: '123' }), 2);
  });
});
