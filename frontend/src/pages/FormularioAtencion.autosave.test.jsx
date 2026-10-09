// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FormularioAtencion from './FormularioAtencion.jsx';
import { getPplByDocumento, updatePpl } from '../services/api.js';
import { buildFormAutosaveContext, readFormAutosaveDraft, writeFormAutosaveDraft } from '../utils/formAutosave.js';

const fixture = vi.hoisted(() => ({ record: null }));

vi.mock('../services/api.js', () => ({
  createPplActuacion: vi.fn(),
  getCondenadosFilterOptions: vi.fn().mockResolvedValue({}),
  getDefensoresCatalogo: vi.fn().mockResolvedValue([]),
  getPplActuacionesByDocumento: vi.fn().mockResolvedValue({ actuaciones: [] }),
  getPplByDocumento: vi.fn(),
  isQueuedResponse: (value) => Boolean(value?.queued || value?.__queued),
  updatePpl: vi.fn(),
}));
vi.mock('../services/authStorage.js', () => ({
  getStoredSession: () => ({ user: { id: 'tester' } }),
}));
vi.mock('../components/HistorialActuacionesPPL.jsx', () => ({
  default: ({ onSelectActuacion }) => (
    <button onClick={() => onSelectActuacion({ id: 'actuacion-17', registro: fixture.record })}>Abrir actuación</button>
  ),
}));

describe.each(['condenado', 'sindicado'])('autoguardado del formulario %s', (tipo) => {
  let root;
  let container;
  let base;
  const summaryKey = tipo === 'condenado'
    ? 'Resumen del análisis del caso'
    : 'RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T16:00:00Z'));
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => setTimeout(() => callback(0), 0));
    localStorage.clear();
    getPplByDocumento.mockReset();
    updatePpl.mockReset();
    base = {
      numeroIdentificacion: '123',
      Nombre: 'Usuario de prueba',
      'Situación Jurídica': tipo === 'condenado' ? 'Condenado' : 'Sindicado',
      __oracleIdGestion: 17,
      [summaryKey]: '',
      'Fecha de análisis jurídico del caso': '',
    };
    fixture.record = base;
    getPplByDocumento.mockResolvedValue({ tipo, registro: base });
    updatePpl.mockImplementation(async (_doc, payload) => ({ tipo, registro: { ...base, ...payload.data } }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount() {
    await act(async () => root.render(<StrictMode><FormularioAtencion numeroInicial="123" /></StrictMode>));
    await click('Abrir actuación');
    await advance(0);
  }

  async function advance(time) {
    await act(async () => vi.advanceTimersByTimeAsync(time));
  }

  async function click(text) {
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent === text);
    expect(button, text).toBeDefined();
    await act(async () => button.click());
  }

  async function edit(name, value) {
    const input = [...container.querySelectorAll('input, textarea')].find((item) => item.name === name);
    expect(input, name).toBeDefined();
    expect(input.disabled).toBe(false);
    await act(async () => {
      const prototype = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return input;
  }

  function draft() {
    const context = buildFormAutosaveContext({ subject: 'tester', documento: '123', gestionId: 17, actuacionId: 'actuacion-17' });
    return readFormAutosaveDraft(localStorage, context);
  }

  it('consultar sin editar no dispara guardados y funciona dentro de StrictMode', async () => {
    await mount();
    await advance(120000);
    expect(updatePpl).not.toHaveBeenCalled();
  });

  it('protege inmediatamente el borrador local y envía el último cambio a los 30 segundos', async () => {
    await mount();
    await edit(summaryKey, 'Primera edición');
    expect(draft().data[summaryKey]).toBe('Primera edición');
    await advance(10000);
    await edit(summaryKey, 'Última edición');
    expect(draft().data[summaryKey]).toBe('Última edición');
    await advance(19999);
    expect(updatePpl).not.toHaveBeenCalled();
    await advance(1);
    expect(updatePpl).toHaveBeenCalledExactlyOnceWith('123', expect.objectContaining({
      actuacionId: 'actuacion-17',
      data: expect.objectContaining({ [summaryKey]: 'Última edición' }),
    }));
    expect(draft()).toBeNull();
    expect(container.textContent).toContain('Cambios guardados automáticamente.');
  });

  it('cambiar entre campos no fuerza escrituras adicionales', async () => {
    await mount();
    const field = await edit(summaryKey, 'Resumen');
    await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await edit('Fecha de análisis jurídico del caso', '2026-10-09');
    await advance(2000);
    expect(updatePpl).not.toHaveBeenCalled();
    await advance(28000);
    expect(updatePpl).toHaveBeenCalledTimes(1);
    expect(updatePpl.mock.calls[0][1].data).toMatchObject({
      [summaryKey]: 'Resumen',
      'Fecha de análisis jurídico del caso': '2026-10-09',
    });
  });

  it('revertir al valor original cancela el envío y elimina el borrador', async () => {
    await mount();
    await edit(summaryKey, 'Edición temporal');
    await edit(summaryKey, '');
    await advance(60000);
    expect(updatePpl).not.toHaveBeenCalled();
    expect(draft()).toBeNull();
  });

  it('retiene el borrador ante un error y recupera el envío después de 30 segundos', async () => {
    await mount();
    updatePpl.mockRejectedValueOnce(new Error('Servidor ocupado'));
    await edit(summaryKey, 'Cambio protegido');
    await advance(30000);
    expect(draft().data[summaryKey]).toBe('Cambio protegido');
    expect(container.textContent).toContain('No fue posible sincronizar');
    await advance(29999);
    expect(updatePpl).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(updatePpl).toHaveBeenCalledTimes(2);
    expect(draft()).toBeNull();
  });

  it('guardar manualmente incluye lo pendiente sin esperar 30 segundos', async () => {
    await mount();
    await edit(summaryKey, 'Cambio para guardar manualmente');
    await click('GUARDAR ENTREVISTA');
    expect(updatePpl).toHaveBeenCalledTimes(2);
    expect(updatePpl.mock.calls[0][1].data[summaryKey]).toBe('Cambio para guardar manualmente');
    expect(updatePpl.mock.calls[1][1].data[summaryKey]).toBe('Cambio para guardar manualmente');
    await advance(60000);
    expect(updatePpl).toHaveBeenCalledTimes(2);
  });

  it('la respuesta lenta no reemplaza las ediciones nuevas ni elimina su borrador', async () => {
    await mount();
    let finishFirst;
    updatePpl.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
    await edit(summaryKey, 'Versión enviada');
    await advance(30000);
    await edit(summaryKey, 'Versión nueva');
    await advance(100);
    await act(async () => finishFirst({ tipo, registro: { ...base, [summaryKey]: 'Versión enviada' } }));
    expect(draft().data[summaryKey]).toBe('Versión nueva');
    const textarea = [...container.querySelectorAll('textarea')].find((item) => item.name === summaryKey);
    expect(textarea.value).toBe('Versión nueva');
    await advance(29999);
    expect(updatePpl).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(updatePpl).toHaveBeenCalledTimes(2);
    expect(updatePpl.mock.calls[1][1].data[summaryKey]).toBe('Versión nueva');
    expect(draft()).toBeNull();
  });

  it('al ocultar la pestaña intenta guardar inmediatamente', async () => {
    await mount();
    await edit(summaryKey, 'Cambio antes de salir');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(updatePpl).toHaveBeenCalledTimes(1);
    expect(updatePpl.mock.calls[0][1].data[summaryKey]).toBe('Cambio antes de salir');
    await advance(60000);
    expect(updatePpl).toHaveBeenCalledTimes(1);
  });

  it('los cambios de pestaña tras un error respetan la espera del reintento', async () => {
    await mount();
    updatePpl.mockRejectedValueOnce(new Error('Servidor ocupado'));
    await edit(summaryKey, 'Cambio pendiente');
    await advance(30000);
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    for (let index = 0; index < 5; index += 1) {
      visibility.mockReturnValue('visible');
      await act(async () => document.dispatchEvent(new Event('visibilitychange')));
      visibility.mockReturnValue('hidden');
      await act(async () => document.dispatchEvent(new Event('visibilitychange')));
      await advance(1000);
    }
    expect(updatePpl).toHaveBeenCalledTimes(1);
    expect(draft().data[summaryKey]).toBe('Cambio pendiente');
    await advance(25000);
    expect(updatePpl).toHaveBeenCalledTimes(2);
  });

  it('al abandonar el formulario envía el borrador pendiente', async () => {
    await mount();
    await edit(summaryKey, 'Cambio antes de navegar');
    await act(async () => root.unmount());
    expect(updatePpl).toHaveBeenCalledTimes(1);
    expect(updatePpl.mock.calls[0][1].data[summaryKey]).toBe('Cambio antes de navegar');
    expect(draft()).toBeNull();
  });

  it('si falla al navegar recupera el borrador al volver a abrir la actuación', async () => {
    await mount();
    await edit(summaryKey, 'Cambio recuperable');
    updatePpl.mockRejectedValueOnce(new Error('Sin conexión'));
    await act(async () => root.unmount());
    expect(draft().data[summaryKey]).toBe('Cambio recuperable');
    root = createRoot(container);
    await mount();
    expect(updatePpl).toHaveBeenCalledTimes(2);
    expect(updatePpl.mock.calls[1][1].data[summaryKey]).toBe('Cambio recuperable');
    expect(draft()).toBeNull();
  });

  it('preserva el último borrador si se navega durante un envío lento y falla el siguiente', async () => {
    await mount();
    let finishFirst;
    updatePpl.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
    await edit(summaryKey, 'Versión en curso');
    await advance(30000);
    await edit(summaryKey, 'Versión más reciente');
    updatePpl.mockRejectedValueOnce(new Error('Sin conexión al navegar'));
    await act(async () => root.unmount());
    await act(async () => finishFirst({ tipo, registro: { ...base, [summaryKey]: 'Versión en curso' } }));
    expect(updatePpl).toHaveBeenCalledTimes(2);
    expect(draft().data[summaryKey]).toBe('Versión más reciente');
  });

  it('mantiene la respuesta sin conexión en cola sin repetir guardados vacíos', async () => {
    await mount();
    updatePpl.mockResolvedValueOnce({ queued: true });
    await edit(summaryKey, 'Cambio sin conexión');
    await advance(30000);
    expect(container.textContent).toContain('Sin conexión: cambios protegidos y pendientes de sincronización.');
    await advance(90000);
    expect(updatePpl).toHaveBeenCalledTimes(1);
  });

  it('las ediciones de otros bloques no activan este autoguardado', async () => {
    await mount();
    await edit('Nombre', 'Nombre corregido');
    await advance(60000);
    expect(updatePpl).not.toHaveBeenCalled();
  });

  it('recupera un borrador existente sin esperar la ventana automática', async () => {
    const context = buildFormAutosaveContext({ subject: 'tester', documento: '123', gestionId: 17 });
    writeFormAutosaveDraft(localStorage, context, { [summaryKey]: 'Borrador previo' });
    await mount();
    expect(updatePpl).toHaveBeenCalledTimes(1);
    expect(updatePpl.mock.calls[0][1].data[summaryKey]).toBe('Borrador previo');
  });
});
