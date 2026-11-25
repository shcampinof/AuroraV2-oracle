import { useEffect, useId, useRef } from 'react';
import './AdminUserActions.css';

function PermissionSwitch({ title, description, checked, disabled, onChange, enabledText = 'Activo', disabledText = 'Inactivo' }) {
  const id = useId();
  return (
    <div className="user-permission-row">
      <div className="user-permission-copy">
        <span id={`${id}-title`} className="user-permission-title">{title}</span>
        <p id={`${id}-description`}>{description}</p>
      </div>
      <div className="user-permission-control">
        <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`} className="user-permission-switch" disabled={disabled} onClick={onChange}>
          <span className="user-permission-switch-track" aria-hidden="true" />
        </button>
        <span className="user-permission-state" aria-hidden="true">{checked ? enabledText : disabledText}</span>
      </div>
    </div>
  );
}

export default function AdminUserActions({ user, roles, busy, error, onPatch, onPag, onDelete, onClose }) {
  const dialog = useRef(null);
  const activeControl = useRef(null);
  const wasBusy = useRef(false);
  const enabled = user.enabled !== false;
  const name = user.name || user.email || 'Usuario';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    return () => { document.body.style.overflow = overflow; previousFocus?.focus?.(); };
  }, []);
  useEffect(() => {
    if (busy) dialog.current?.focus();
    else if (wasBusy.current && activeControl.current?.isConnected) activeControl.current.focus();
    wasBusy.current = busy;
  }, [busy]);
  function patch(updates) {
    activeControl.current = document.activeElement;
    onPatch(updates);
  }
  function keys(event) {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    if (busy) { event.preventDefault(); return; }
    const controls = [...dialog.current.querySelectorAll('button')].filter((el) => !el.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  function toggle(role) {
    const active = roles.includes(role);
    patch({ roles: active ? roles.filter((item) => item !== role && !item.endsWith(`.${role}`)) : [...roles, role] });
  }
  return (
    <div className="admin-modal-backdrop user-permissions-backdrop">
      <section className="user-permissions-dialog" ref={dialog} role="dialog" aria-modal="true" tabIndex={-1}
        aria-labelledby="user-permissions-title" aria-describedby="user-permissions-email" onKeyDown={keys} aria-busy={busy}>
        <header className="user-permissions-header">
          <div>
            <span className="user-permissions-eyebrow">Usuarios autorizados</span>
            <h3 id="user-permissions-title">Acceso y permisos</h3>
          </div>
          <button type="button" className="user-permissions-close" aria-label="Cerrar" title="Cerrar" disabled={busy} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="user-permissions-body">
          <div className="user-permissions-identity">
            <span className="user-permissions-avatar" aria-hidden="true">{initials}</span>
            <div><strong>{name}</strong><p id="user-permissions-email">{user.email}</p></div>
          </div>
          {error ? <p role="alert" className="user-permissions-error">{error}</p> : null}
          <section className="user-permissions-access" aria-label="Acceso al aplicativo">
            <PermissionSwitch title="Acceso al aplicativo" description="Puede iniciar sesión en AURORA."
              checked={enabled} disabled={busy} onChange={() => patch({ enabled: !enabled })}
              enabledText="Habilitado" disabledText="Deshabilitado" />
          </section>
          <section className="user-permissions-roles" aria-labelledby="user-permissions-roles-title">
            <h4 id="user-permissions-roles-title">Roles y permisos</h4>
            <p className="user-permissions-hint">Los cambios se guardan automáticamente.</p>
            <PermissionSwitch title="Consulta" description="Consulta información y edita solo los casos autorizados."
              checked={roles.includes('consulta')} disabled={busy} onChange={() => toggle('consulta')} />
            <div className="user-permission-row">
              <div className="user-permission-copy"><span className="user-permission-title">PAG</span>
                <p>Asigna casos dentro de su regional.</p>
              </div>
              <div className="user-permission-pag-control">
                <span className={`user-permission-badge${roles.includes('pag') ? ' is-active' : ''}`}>{roles.includes('pag') ? 'Activo' : 'Sin asignar'}</span>
                <button type="button" className="user-permission-pag-button" disabled={busy}
                  onClick={() => roles.includes('pag') ? toggle('pag') : onPag()}>
                  {roles.includes('pag') ? 'Retirar PAG' : 'Configurar PAG'}
                </button>
              </div>
            </div>
            <PermissionSwitch title="DNDP" description="Asigna casos de todas las regionales."
              checked={roles.includes('dndp')} disabled={busy} onChange={() => toggle('dndp')} />
            <PermissionSwitch title="Administrador" description="Administra usuarios y permisos."
              checked={roles.includes('admin')} disabled={busy} onChange={() => toggle('admin')} />
            {roles.includes('consulta') ? <p className="user-permissions-consulta-note">Con Consulta activo, la edición se limita a los casos autorizados, aunque tenga otros roles.</p> : null}
          </section>
          <div className="user-permissions-remove">
            <div><strong>Retirar usuario</strong><p>Elimina su registro de usuarios autorizados.</p></div>
            <button type="button" disabled={busy} onClick={onDelete}>Eliminar usuario</button>
          </div>
        </div>
        <footer className="user-permissions-footer">
          <span role="status" aria-live="polite">{busy ? 'Guardando cambios…' : 'Los cambios se aplican al instante.'}</span>
          <button type="button" disabled={busy} onClick={onClose}>Listo</button>
        </footer>
      </section>
    </div>
  );
}
