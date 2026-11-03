import { useEffect, useRef, useState } from 'react';
import RegionalPagSelect from './RegionalPagSelect.jsx';

export default function PagUserModal({ user, existing, regionales, loading, catalogError, onRetry, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...user });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('input:not([readonly])')?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, []);

  async function submit(event) {
    event.preventDefault();
    const regional = regionales.find((option) => option.localeCompare(String(draft.pagRegional || '').trim(), 'es', { sensitivity: 'base' }) === 0);
    if (!regional || catalogError || loading) { setError('Seleccione una regional PAG de la lista de regionales existentes.'); return; }
    if (!/^[1-9]\d{0,37}$/.test(draft.pagCedula || '')) { setError('Ingrese una cédula válida, solo con dígitos y sin ceros iniciales.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...draft, email: String(draft.email || '').trim().toLowerCase(), pagRegional: regional });
    } catch (err) {
      setError(String(err?.message || 'No fue posible guardar el PAG.'));
      setSaving(false);
    }
  }

  function handleKeys(event) {
    if (event.key === 'Escape' && !saving) { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('input, button, [tabindex="0"]')]
      .filter((element) => !element.disabled && element.tabIndex >= 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <div className="admin-modal-backdrop">
      <section ref={dialogRef} className="pag-user-modal" role="dialog" aria-modal="true"
        aria-labelledby="pag-user-title" aria-describedby="pag-user-description" onKeyDown={handleKeys}>
        <h3 id="pag-user-title">Registrar usuario como PAG</h3>
        <p id="pag-user-description">Complete los datos para habilitar el rol PAG y registrar su acceso al módulo de asignación.</p>
        <form onSubmit={submit}>
          {error ? <div className="status-banner status-banner--error" role="alert">{error}</div> : null}
          <label>Correo
            <input type="email" required maxLength={200} readOnly={existing} disabled={saving} value={draft.email || ''}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>Nombre
            <input type="text" required maxLength={200} disabled={saving} value={draft.name || ''}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>Cédula PAG
            <input type="text" required inputMode="numeric" pattern="[1-9][0-9]*" maxLength={38} disabled={saving} value={draft.pagCedula || ''}
              onChange={(event) => setDraft((current) => ({ ...current, pagCedula: event.target.value }))} />
          </label>
          <RegionalPagSelect value={draft.pagRegional || ''} options={regionales} disabled={saving || loading || Boolean(catalogError)}
            onChange={(value) => setDraft((current) => ({ ...current, pagRegional: value }))} />
          {loading ? <p role="status">Cargando regionales...</p> : null}
          {catalogError ? <div role="alert">{catalogError} <button type="button" onClick={onRetry}>Reintentar</button></div> : null}
          <div className="pag-user-modal-actions">
            <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={saving || loading || Boolean(catalogError)}>
              {saving ? 'Guardando...' : 'Guardar PAG'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
