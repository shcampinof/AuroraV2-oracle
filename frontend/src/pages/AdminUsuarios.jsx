import { useEffect, useMemo, useRef, useState } from 'react';
import PagUserModal from '../components/PagUserModal.jsx';

import {
  deleteAdminUser,
  getAdminUsers,
  getPagRegionales,
  importAdminUsersCsv,
  previewAdminUsersCsv,
  saveAdminUser,
  updateAdminUser,
} from '../services/api.js';

const ROLE_OPTIONS = [
  { id: 'user', label: 'Usuario' },
  { id: 'pag', label: 'PAG' },
  { id: 'dndp', label: 'DNDP' },
  { id: 'admin', label: 'Admin' },
  { id: 'carguebd', label: 'Cargas' },
];
const EMPTY_FORM = { email: '', name: '', pagCedula: '', pagRegional: '', roles: ['user'], enabled: true };

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function normalizeRoles(roles) {
  const input = Array.isArray(roles) ? roles : [];
  const set = new Set();
  input.forEach((role) => {
    const raw = String(role || '').trim().toLowerCase();
    if (!raw) return;
    set.add(raw);
    const dotIndex = raw.lastIndexOf('.');
    if (dotIndex >= 0 && dotIndex < raw.length - 1) set.add(raw.slice(dotIndex + 1));
  });
  if (!set.size) set.add('user');
  return Array.from(set);
}

function AdminUsuarios() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [pagDialog, setPagDialog] = useState(null);
  const [regionales, setRegionales] = useState([]);
  const [regionalesLoading, setRegionalesLoading] = useState(true);
  const [regionalesError, setRegionalesError] = useState('');
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const csvInputRef = useRef(null);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return sortedUsers;
    return sortedUsers.filter((user) => {
      const roles = normalizeRoles(user.roles).join(' ');
      const status = user.enabled === false ? 'deshabilitado disabled' : 'habilitado enabled';
      return [user.email, user.name, user.username, user.pagCedula, user.pagRegional, roles, status]
        .some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [query, sortedUsers]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function refresh() {
    const data = await getAdminUsers();
    setUsers(Array.isArray(data?.users) ? data.users : []);
  }

  async function loadRegionales() {
    setRegionalesLoading(true);
    setRegionalesError('');
    try {
      const data = await getPagRegionales();
      const options = [...new Set((data?.regionales || []).map((item) => String(item).trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'));
      if (!options.length) throw new Error('No hay regionales disponibles.');
      setRegionales(options);
    } catch (err) {
      setRegionalesError(String(err?.message || 'No fue posible cargar las regionales PAG.'));
    } finally {
      setRegionalesLoading(false);
    }
  }

  useEffect(() => { loadRegionales(); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (!alive) return;
        setError(String(err?.message || 'No fue posible cargar los usuarios.'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  function setRole(role, checked) {
    if (role === 'pag' && checked) {
      openPagDialog(form, editingId, true);
      return;
    }
    setForm((current) => {
      const nextRoles = new Set(normalizeRoles(current.roles));
      if (checked) nextRoles.add(role);
      else nextRoles.forEach((value) => {
        if (value === role || value.endsWith(`.${role}`)) nextRoles.delete(value);
      });
      if (!nextRoles.size) nextRoles.add('user');
      return { ...current, roles: Array.from(nextRoles) };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    const email = String(form.email || '').trim().toLowerCase();
    if (!email) {
      setError('Ingrese el correo institucional.');
      return;
    }
    if (form.roles.includes('pag')) {
      openPagDialog(form, editingId, true);
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...form, email, roles: normalizeRoles(form.roles) };
      if (editingId) await updateAdminUser(editingId, payload);
      else await saveAdminUser(payload);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setMessage('Usuario guardado.');
      await refresh();
    } catch (err) {
      setError(String(err?.message || 'No fue posible guardar el usuario.'));
    } finally {
      setSubmitting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFFcorreo\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_usuarios_autorizados.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearCsv() {
    setCsvFile(null);
    setCsvPreview(null);
    if (csvInputRef.current) csvInputRef.current.value = '';
  }

  async function handleCsvPreview() {
    if (!csvFile) {
      setError('Seleccione un archivo CSV.');
      return;
    }
    setMessage('');
    setError('');
    setCsvLoading(true);
    try {
      const data = await previewAdminUsersCsv(csvFile);
      setCsvPreview(data?.preview || null);
    } catch (err) {
      setCsvPreview(null);
      setError(String(err?.message || 'No fue posible analizar el CSV.'));
    } finally {
      setCsvLoading(false);
    }
  }

  async function handleCsvImport() {
    if (!csvFile || !csvPreview?.summary?.ready) return;
    setMessage('');
    setError('');
    setCsvLoading(true);
    try {
      const data = await importAdminUsersCsv(csvFile);
      clearCsv();
      setMessage(`${Number(data?.imported || 0)} usuarios importados. Los registros existentes no fueron modificados.`);
      await refresh();
    } catch (err) {
      setError(String(err?.message || 'No fue posible importar los usuarios.'));
    } finally {
      setCsvLoading(false);
    }
  }

  async function patchUser(user, patch) {
    setMessage('');
    setError('');
    try {
      await updateAdminUser(user.id || user.email, patch);
      setMessage('Usuario actualizado.');
      await refresh();
    } catch (err) {
      setError(String(err?.message || 'No fue posible actualizar el usuario.'));
    }
  }

  function editUser(user) {
    setEditingId(user.id || user.email);
    setForm({ ...EMPTY_FORM, ...user, roles: normalizeRoles(user.roles) });
    setMessage('');
    setError('');
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  function openPagDialog(user, id = null, fromForm = false) {
    setPagDialog({ user: { ...EMPTY_FORM, ...user, roles: [...new Set([...normalizeRoles(user.roles), 'pag'])] }, id, fromForm });
  }

  async function savePagUser(payload) {
    if (pagDialog.id) await updateAdminUser(pagDialog.id, payload);
    else await saveAdminUser(payload);
    if (pagDialog.fromForm || pagDialog.id === editingId) { setForm(EMPTY_FORM); setEditingId(null); }
    setPagDialog(null);
    setError('');
    setMessage('Usuario PAG guardado con cédula, correo y regional.');
    await refresh().catch((err) => setError(String(err?.message || 'El PAG se guardó, pero no fue posible actualizar el listado.')));
  }

  async function handleDelete(user) {
    const email = user.email || user.username || user.id;
    const confirmed = window.confirm(`¿Eliminar ${email} de usuarios autorizados? En modo restrictivo no podra ingresar hasta que se agregue nuevamente.`);
    if (!confirmed) return;

    setMessage('');
    setError('');
    try {
      await deleteAdminUser(user.id || user.email);
      setMessage('Usuario eliminado.');
      await refresh();
    } catch (err) {
      setError(String(err?.message || 'No fue posible eliminar el usuario.'));
    }
  }

  return (
    <section className="admin-users-page">
      <header className="admin-loads-header">
        <div>
          <h2>Usuarios autorizados</h2>
          <p>Administre correos habilitados, roles internos y acceso a modulos administrativos.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => refresh()} disabled={loading}>
          Actualizar
        </button>
      </header>

      {message ? <div className="status-banner status-banner--ok">{message}</div> : null}
      {error ? <div className="status-banner status-banner--error">{error}</div> : null}

      <form className="admin-users-form" onSubmit={handleSubmit}>
        <label>
          Correo
          <input
            type="email"
            readOnly={Boolean(editingId)}
            value={form.email}
            placeholder="usuario@defensoria.gov.co"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </label>
        <label>
          Nombre
          <input type="text" value={form.name} maxLength={200}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <fieldset className="admin-users-roles">
          <legend>Roles</legend>
          {ROLE_OPTIONS.map((role) => (
            <label key={role.id}>
              <input
                type="checkbox"
                checked={normalizeRoles(form.roles).includes(role.id)}
                onChange={(event) => setRole(role.id, event.target.checked)}
              />
              {role.label}
            </label>
          ))}
        </fieldset>
        {form.roles.includes('pag') ? (
          <div className="admin-users-pag-help">
            <span>PAG: {form.pagCedula || 'Cédula pendiente'} · {form.pagRegional || 'Regional pendiente'} </span>
            <button type="button" onClick={() => openPagDialog(form, editingId, true)}>Editar datos PAG</button>
          </div>
        ) : null}
        {form.roles.includes('dndp') ? <p className="admin-users-pag-help">DNDP permite acceder a la asignación de casos sin cédula ni regional PAG.</p> : null}
        <label className="admin-users-enabled">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          />
          Habilitado
        </label>
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar usuario'}
        </button>
        {editingId ? <button type="button" className="secondary-button" disabled={submitting}
          onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Cancelar edición</button> : null}
      </form>
      {pagDialog ? <PagUserModal user={pagDialog.user} existing={Boolean(pagDialog.id)} regionales={regionales}
        loading={regionalesLoading} catalogError={regionalesError} onRetry={loadRegionales}
        onSave={savePagUser} onClose={() => setPagDialog(null)} /> : null}

      <section className="admin-users-import" aria-labelledby="csv-import-title">
        <div className="admin-users-import-header">
          <div>
            <h3 id="csv-import-title">Importar usuarios desde CSV</h3>
            <p>El archivo solo necesita la columna <strong>correo</strong>. Los usuarios se crean habilitados con rol Usuario.</p>
          </div>
          <button type="button" className="secondary-button" onClick={downloadTemplate}>
            Descargar plantilla
          </button>
        </div>
        <div className="admin-users-import-controls">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="Archivo CSV de usuarios autorizados"
            onChange={(event) => {
              setCsvFile(event.target.files?.[0] || null);
              setCsvPreview(null);
              setMessage('');
              setError('');
            }}
          />
          <button type="button" onClick={handleCsvPreview} disabled={!csvFile || csvLoading}>
            {csvLoading && !csvPreview ? 'Analizando...' : 'Ver vista previa'}
          </button>
          {(csvFile || csvPreview) ? (
            <button type="button" className="secondary-button" onClick={clearCsv} disabled={csvLoading}>
              Cancelar
            </button>
          ) : null}
        </div>

        {csvPreview ? (
          <div className="admin-users-preview">
            <div className="admin-users-preview-summary">
              <span><strong>{csvPreview.summary?.ready || 0}</strong> nuevos</span>
              <span><strong>{csvPreview.summary?.existing || 0}</strong> existentes</span>
              <span><strong>{csvPreview.summary?.duplicates || 0}</strong> repetidos</span>
              <span><strong>{csvPreview.summary?.invalid || 0}</strong> con error</span>
            </div>
            <div className="admin-users-preview-table-wrap">
              <table className="admin-users-preview-table">
                <thead>
                  <tr><th>Línea</th><th>Correo</th><th>Resultado</th></tr>
                </thead>
                <tbody>
                  {(csvPreview.entries || []).slice(0, 100).map((entry) => (
                    <tr key={`${entry.line}-${entry.email}`}>
                      <td>{entry.line}</td>
                      <td>{entry.email || '-'}</td>
                      <td className={`csv-status csv-status--${entry.status}`}>{entry.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(csvPreview.entries || []).length > 100 ? <p>Se muestran las primeras 100 filas de la vista previa.</p> : null}
            <div className="admin-users-preview-actions">
              <p>Los correos existentes no se modificarán.</p>
              <button type="button" className="primary-button" onClick={handleCsvImport} disabled={!csvPreview.summary?.ready || csvLoading}>
                {csvLoading ? 'Importando...' : `Confirmar importación (${csvPreview.summary?.ready || 0})`}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="admin-users-toolbar">
        <label>
          Buscar
          <input
            type="search"
            value={query}
            placeholder="Correo, nombre, cédula, regional, rol o estado"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Filas
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <div className="admin-users-count">
          {filteredUsers.length} de {users.length} usuarios
        </div>
      </div>

      <div className="admin-loads-table-wrap">
        <table className="admin-loads-table admin-users-table">
          <thead>
            <tr>
              <th>Correo</th>
              <th>Nombre</th>
              <th>Roles</th>
              <th>Estado</th>
              <th>Ultimo ingreso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length ? (
              visibleUsers.map((user) => {
                const roles = normalizeRoles(user.roles);
                const enabled = user.enabled !== false;
                return (
                  <tr key={user.id || user.email}>
                    <td>{user.email || '-'}</td>
                    <td>{user.name || 'Pendiente de primer ingreso'}</td>
                    <td>{roles.join(', ')}</td>
                    <td>
                      <span className={`user-status ${enabled ? 'user-status--enabled' : 'user-status--disabled'}`}>
                        {enabled ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </td>
                    <td>{formatDate(user.lastLoginAt)}</td>
                    <td className="admin-loads-actions">
                      <button type="button" onClick={() => editUser(user)}>Editar</button>
                      <button type="button" onClick={() => patchUser(user, { enabled: !enabled })}>
                        {enabled ? 'Deshabilitar' : 'Habilitar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => roles.includes('pag')
                          ? patchUser(user, { roles: roles.filter((role) => role !== 'pag' && !role.endsWith('.pag')) })
                          : openPagDialog(user, user.id || user.email)}
                      >
                        {roles.includes('pag') ? 'Quitar PAG' : 'Habilitar PAG'}
                      </button>
                      <button type="button" onClick={() => patchUser(user, { roles: roles.includes('dndp')
                        ? roles.filter((role) => role !== 'dndp' && !role.endsWith('.dndp')) : [...roles, 'dndp'] })}>
                        {roles.includes('dndp') ? 'Quitar DNDP' : 'Habilitar DNDP'}
                      </button>
                      <button
                        type="button"
                        onClick={() => patchUser(user, { roles: roles.includes('admin') ? roles.filter((role) => role !== 'admin') : [...roles, 'admin'] })}
                      >
                        {roles.includes('admin') ? 'Quitar admin' : 'Hacer admin'}
                      </button>
                      <button type="button" className="danger-button" onClick={() => handleDelete(user)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="empty-table-cell">
                  {loading ? 'Cargando...' : 'No hay usuarios registrados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-users-pagination" aria-label="Paginacion de usuarios">
        <button type="button" onClick={() => setPage(1)} disabled={safePage <= 1}>
          Primero
        </button>
        <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>
          Anterior
        </button>
        <span>Pagina {safePage} de {totalPages}</span>
        <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>
          Siguiente
        </button>
        <button type="button" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>
          Ultimo
        </button>
      </div>
    </section>
  );
}

export default AdminUsuarios;
