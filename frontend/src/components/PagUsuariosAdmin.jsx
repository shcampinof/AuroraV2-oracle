import { useEffect, useMemo, useState } from 'react';

import { getAdminUsers, updateAdminUser } from '../services/api.js';

function normalizeRoles(roles) {
  const values = Array.isArray(roles) ? roles : [];
  return Array.from(
    values.reduce((set, role) => {
      const raw = String(role || '').trim().toLowerCase();
      if (!raw) return set;
      set.add(raw);
      const dotIndex = raw.lastIndexOf('.');
      if (dotIndex >= 0 && dotIndex < raw.length - 1) set.add(raw.slice(dotIndex + 1));
      return set;
    }, new Set())
  );
}

function PagUsuariosAdmin() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const data = await getAdminUsers();
    setUsers(Array.isArray(data?.users) ? data.users : []);
  }

  async function handleRefresh() {
    setLoading(true);
    setError('');
    try {
      await refresh();
    } catch (err) {
      setError(String(err?.message || 'No fue posible cargar los usuarios.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (alive) setError(String(err?.message || 'No fue posible cargar los usuarios.'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const visibleUsers = useMemo(() => {
    const safeQuery = String(query || '').trim().toLowerCase();
    return [...users]
      .sort((left, right) => String(left.email || '').localeCompare(String(right.email || '')))
      .filter((user) => {
        if (!safeQuery) return true;
        const roles = normalizeRoles(user.roles).join(' ');
        return [user.email, user.name, user.username, roles]
          .some((value) => String(value || '').toLowerCase().includes(safeQuery));
      });
  }, [query, users]);

  async function togglePag(user) {
    const id = String(user.id || user.email || '');
    const roles = normalizeRoles(user.roles);
    const hasPag = roles.includes('pag');
    const nextRoles = hasPag
      ? roles.filter((role) => role !== 'pag')
      : [...roles, 'pag'];

    setUpdatingId(id);
    setMessage('');
    setError('');
    try {
      await updateAdminUser(id, { roles: nextRoles });
      setMessage(hasPag ? 'Acceso PAG retirado.' : 'Acceso PAG habilitado.');
      await refresh();
    } catch (err) {
      setError(String(err?.message || 'No fue posible actualizar el acceso PAG.'));
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <section className="admin-users-import" aria-labelledby="pag-users-title">
      <div className="admin-users-import-header">
        <div>
          <h3 id="pag-users-title">Personas con acceso a PAG</h3>
          <p>Habilitar o deshabilitar aquí afecta solamente el módulo PAG, no el ingreso general a AURORA.</p>
        </div>
        <button type="button" className="secondary-button" onClick={handleRefresh} disabled={loading}>
          Actualizar
        </button>
      </div>

      {message ? <div className="status-banner status-banner--ok">{message}</div> : null}
      {error ? <div className="status-banner status-banner--error">{error}</div> : null}

      <div className="admin-users-toolbar">
        <label>
          Buscar persona
          <input
            type="search"
            value={query}
            placeholder="Correo, nombre o rol"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="admin-users-count">
          {users.filter((user) => normalizeRoles(user.roles).includes('pag')).length} con acceso PAG
        </div>
      </div>

      <div className="admin-loads-table-wrap">
        <table className="admin-loads-table admin-users-table">
          <thead>
            <tr>
              <th>Correo</th>
              <th>Nombre</th>
              <th>Acceso general</th>
              <th>Acceso PAG</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length ? (
              visibleUsers.map((user) => {
                const id = String(user.id || user.email || '');
                const hasPag = normalizeRoles(user.roles).includes('pag');
                const enabled = user.enabled !== false;
                return (
                  <tr key={id}>
                    <td>{user.email || '-'}</td>
                    <td>{user.name || 'Pendiente de primer ingreso'}</td>
                    <td>
                      <span className={`user-status ${enabled ? 'user-status--enabled' : 'user-status--disabled'}`}>
                        {enabled ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </td>
                    <td>
                      <span className={`user-status ${hasPag ? 'user-status--enabled' : 'user-status--disabled'}`}>
                        {hasPag ? 'Habilitado' : 'Sin acceso'}
                      </span>
                    </td>
                    <td className="admin-loads-actions">
                      <button
                        type="button"
                        onClick={() => togglePag(user)}
                        disabled={updatingId === id}
                      >
                        {updatingId === id
                          ? 'Actualizando...'
                          : hasPag
                            ? 'Deshabilitar PAG'
                            : 'Habilitar PAG'}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="empty-table-cell">
                  {loading ? 'Cargando...' : 'No hay usuarios para mostrar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PagUsuariosAdmin;
