import { useEffect, useRef, useState } from 'react';
import { changeConsultaCases, getConsultaCases, searchConsultaCases } from '../services/api.js';
import { isConsultaUser } from '../utils/assignmentAccess.js';

const EMPTY_FILTERS = { documento: '', nombre: '', defensor: '', regional: '' };

export default function ConsultaCasePermissions({ users }) {
  const [userId, setUserId] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchedFilters, setSearchedFilters] = useState(EMPTY_FILTERS);
  const [results, setResults] = useState(null);
  const [grants, setGrants] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const searchRequest = useRef(0);
  const selectedUser = users.find((user) => user.id === userId && isConsultaUser(user) && user.enabled !== false);
  const collaboratorId = selectedUser?.id || '';

  useEffect(() => {
    let alive = true;
    setGrants([]);
    setSelected([]);
    setMessage('');
    setError('');
    setLoading(Boolean(collaboratorId));
    if (collaboratorId) {
      getConsultaCases(collaboratorId).then((data) => {
        if (alive) setGrants(data.cases || []);
      }).catch((cause) => { if (alive) setError(cause.message); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [collaboratorId, users]);

  async function search(event, page = 1) {
    event?.preventDefault();
    const request = ++searchRequest.current;
    const applied = event ? filters : searchedFilters;
    setSearching(true);
    setSelected([]);
    setError('');
    setMessage('');
    try {
      const data = await searchConsultaCases(applied, page);
      if (searchRequest.current !== request) return;
      setResults(data);
      setSearchedFilters(applied);
    } catch (cause) {
      if (searchRequest.current === request) { setError(cause.message); setResults(null); }
    } finally { if (searchRequest.current === request) setSearching(false); }
  }

  async function change(action, cases) {
    if (!collaboratorId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await changeConsultaCases(collaboratorId, action, cases);
      setSelected([]);
      const data = await getConsultaCases(collaboratorId);
      setGrants(data.cases || []);
      setMessage(action === 'grant' ? 'Permisos de edición autorizados.' : 'Permiso de edición retirado.');
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  }

  const assigned = new Set(grants.map((grant) => grant.situacionId));
  const rows = results?.cases || [];
  const selectable = rows.filter((row) => !assigned.has(row.situacionId));
  const busy = loading || saving;
  return (
    <section className="consulta-permissions" aria-label="Asignación de casos · Perfil Consulta">
      <p>Autorice la edición de casos a usuarios de Consulta. El defensor responsable se conserva.</p>
      <label className="consulta-collaborator">
        Usuario con perfil Consulta
        <select aria-label="Usuario con perfil Consulta" value={collaboratorId} disabled={saving} onChange={(event) => setUserId(event.target.value)}>
          <option value="">Seleccione un usuario de Consulta</option>
          {users.filter((user) => user.enabled !== false && isConsultaUser(user)).map((user) => (
            <option key={user.id} value={user.id}>{user.name || user.email} · {user.email}</option>
          ))}
        </select>
      </label>
      {!users.some((user) => user.enabled !== false && isConsultaUser(user)) &&
        <p>Habilite una cuenta con rol Consulta en Usuarios y roles para autorizar casos.</p>}
      {error && <div className="status-banner status-banner--error" role="alert">{error}</div>}
      {message && <div className="status-banner status-banner--ok" role="status">{message}</div>}
      {collaboratorId && <>
        <h3>Buscar casos con defensor</h3>
        <form className="consulta-case-filters" onSubmit={search}>
          {Object.entries({ documento: 'Documento de la PPL', nombre: 'Nombre de la PPL', defensor: 'Defensor', regional: 'Regional' }).map(([key, label]) => (
            <label key={key}>{label}<input type="search" maxLength={200} value={filters[key]}
              onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} /></label>
          ))}
          <button type="submit" className="primary-button" disabled={busy || searching || !Object.values(filters).some((value) => value.trim())}>
            {searching ? 'Buscando…' : 'Buscar casos'}
          </button>
        </form>
        {results && <>
          <div className="admin-loads-table-wrap"><table className="admin-loads-table">
            <caption>Resultados de búsqueda · página {results.page}</caption>
            <thead><tr>
              <th><input type="checkbox" aria-label="Seleccionar todos los casos de esta página" disabled={busy || searching || !selectable.length}
                checked={Boolean(selectable.length) && selectable.every((row) => selected.includes(row.situacionId))}
                onChange={(event) => setSelected(event.target.checked ? selectable.map((row) => row.situacionId) : [])} /></th>
              <th>PPL / documento</th><th>Caso / proceso</th><th>Defensor responsable</th><th>Permiso</th>
            </tr></thead>
            <tbody>{rows.map((row) => <tr key={row.situacionId}>
              <td><input type="checkbox" aria-label={`Autorizar caso ${row.situacionId}`} disabled={busy || searching || assigned.has(row.situacionId)}
                checked={selected.includes(row.situacionId)} onChange={(event) => setSelected((current) => event.target.checked
                  ? [...current, row.situacionId] : current.filter((id) => id !== row.situacionId))} /></td>
              <td>{row.nombre}<br />{row.documento}</td><td>{row.situacionId}<br />{row.proceso || 'Sin proceso registrado'}</td>
              <td>{row.defensor}</td><td>{assigned.has(row.situacionId) ? 'Autorizado' : 'Solo lectura'}</td>
            </tr>)}{!rows.length && <tr><td colSpan={5}>No se encontraron casos con esos filtros.</td></tr>}</tbody>
          </table></div>
          <div className="consulta-case-actions">
            <button type="button" className="secondary-button" onClick={() => search(null, results.page - 1)} disabled={busy || searching || results.page <= 1}>Anterior</button>
            <button type="button" className="secondary-button" onClick={() => search(null, results.page + 1)} disabled={busy || searching || !results.hasMore}>Siguiente</button>
            <button type="button" className="primary-button" disabled={busy || searching || !selected.length}
              onClick={() => change('grant', rows.filter((row) => selected.includes(row.situacionId)))}>
              {saving ? 'Guardando…' : `Autorizar edición (${selected.length})`}
            </button>
          </div>
        </>}
        <h3>Casos autorizados ({grants.length})</h3>
        {loading ? <p role="status">Cargando permisos…</p> : <div className="admin-loads-table-wrap"><table className="admin-loads-table">
          <thead><tr><th>PPL / documento</th><th>Caso / proceso</th><th>Defensor responsable</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{grants.map((grant) => <tr key={grant.situacionId}>
            <td>{grant.nombre}<br />{grant.documento}</td><td>{grant.situacionId}<br />{grant.proceso || 'Sin proceso registrado'}</td>
            <td>{grant.disponible ? grant.defensor : 'Sin defensor vigente o caso histórico'}</td>
            <td>{grant.disponible ? 'Edición autorizada según estado del formulario' : 'Solo lectura'}</td>
            <td><button type="button" className="secondary-button" disabled={busy} onClick={() => change('revoke', [grant])}>Retirar permiso</button></td>
          </tr>)}{!grants.length && <tr><td colSpan={5}>El usuario de Consulta no tiene casos autorizados.</td></tr>}</tbody>
        </table></div>}
      </>}
    </section>
  );
}
