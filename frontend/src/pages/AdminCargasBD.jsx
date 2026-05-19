import { useEffect, useMemo, useState } from 'react';

import {
  getCargaBdLog,
  getCargaBdSources,
  getCargasBd,
  retryCargaBd,
  uploadCargaBd,
} from '../services/api.js';

const RUNNING_STATUSES = new Set(['recibido', 'en_ejecucion']);

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

function formatSize(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status) {
  const labels = {
    recibido: 'Recibido',
    en_ejecucion: 'En ejecucion',
    exitoso: 'Exitoso',
    fallido: 'Fallido',
  };
  return labels[status] || status || '-';
}

function sourceHelp(sourceId) {
  if (sourceId === 'aurora_10') return 'Aurora 1.0 se puede deshabilitar por configuracion cuando salga de operacion.';
  if (sourceId === 'sisipec') return 'Archivo mensual consolidado de SISIPEC.';
  if (sourceId === 'ponal') return 'Archivo mensual consolidado de personas en CDT.';
  return '';
}

function AdminCargasBD() {
  const [fuentes, setFuentes] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [fuente, setFuente] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [log, setLog] = useState(null);

  const hasRunningCarga = useMemo(
    () => cargas.some((carga) => RUNNING_STATUSES.has(carga.status)),
    [cargas]
  );

  async function refresh() {
    const [fuentesData, cargasData] = await Promise.all([getCargaBdSources(), getCargasBd()]);
    const nextFuentes = Array.isArray(fuentesData?.fuentes) ? fuentesData.fuentes : [];
    setFuentes(nextFuentes);
    setCargas(Array.isArray(cargasData?.cargas) ? cargasData.cargas : []);
    setFuente((current) => current || nextFuentes.find((item) => item.enabled)?.id || '');
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (!alive) return;
        setError(String(err?.message || 'No fue posible cargar el modulo.'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasRunningCarga) return undefined;
    const timer = window.setInterval(() => {
      refresh().catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hasRunningCarga]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!fuente) {
      setError('Seleccione la fuente de datos.');
      return;
    }
    if (!archivo) {
      setError('Seleccione un archivo .xlsx.');
      return;
    }

    setSubmitting(true);
    try {
      await uploadCargaBd({ fuente, archivo });
      setMessage('Archivo recibido. La carga quedo en ejecucion.');
      setArchivo(null);
      event.currentTarget.reset();
      await refresh();
    } catch (err) {
      setError(String(err?.message || 'No fue posible iniciar la carga.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry(id) {
    setMessage('');
    setError('');
    try {
      await retryCargaBd(id);
      setMessage('Reintento iniciado.');
      await refresh();
    } catch (err) {
      setError(String(err?.message || 'No fue posible reintentar la carga.'));
    }
  }

  async function handleShowLog(carga) {
    setMessage('');
    setError('');
    try {
      const text = await getCargaBdLog(carga.id);
      setLog({ title: `${carga.sourceLabel} - ${carga.originalName}`, text });
    } catch (err) {
      setError(String(err?.message || 'No fue posible consultar el log.'));
    }
  }

  const selectedSource = fuentes.find((item) => item.id === fuente);

  return (
    <section className="admin-loads-page">
      <header className="admin-loads-header">
        <div>
          <h2>Cargas mensuales</h2>
          <p>Suba los Excel oficiales y ejecute la actualizacion de staging y ETL desde Aurora.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => refresh()} disabled={loading}>
          Actualizar
        </button>
      </header>

      {message ? <div className="status-banner status-banner--ok">{message}</div> : null}
      {error ? <div className="status-banner status-banner--error">{error}</div> : null}

      <form className="admin-loads-form" onSubmit={handleSubmit}>
        <label>
          Fuente
          <select value={fuente} onChange={(event) => setFuente(event.target.value)}>
            {fuentes.map((item) => (
              <option key={item.id} value={item.id} disabled={!item.enabled}>
                {item.label}{item.enabled ? '' : ' (deshabilitada)'}
              </option>
            ))}
          </select>
        </label>

        <label>
          Archivo Excel
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setArchivo(event.target.files?.[0] || null)}
          />
        </label>

        <button type="submit" className="primary-button" disabled={submitting || !fuente}>
          {submitting ? 'Subiendo...' : 'Subir y ejecutar'}
        </button>

        <div className="admin-loads-hint">
          {selectedSource ? `${selectedSource.expectedFile}. ${sourceHelp(selectedSource.id)}` : 'Seleccione una fuente.'}
        </div>
      </form>

      <div className="admin-loads-table-wrap">
        <table className="admin-loads-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Fuente</th>
              <th>Archivo</th>
              <th>Estado</th>
              <th>Tamano</th>
              <th>Usuario</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargas.length ? (
              cargas.map((carga) => (
                <tr key={carga.id}>
                  <td>{formatDate(carga.createdAt)}</td>
                  <td>{carga.sourceLabel}</td>
                  <td title={carga.originalName}>{carga.originalName}</td>
                  <td>
                    <span className={`load-status load-status--${carga.status}`}>
                      {statusLabel(carga.status)}
                    </span>
                  </td>
                  <td>{formatSize(carga.size)}</td>
                  <td>{carga.uploadedBy?.name || carga.uploadedBy?.username || '-'}</td>
                  <td className="admin-loads-actions">
                    <button type="button" onClick={() => handleShowLog(carga)}>
                      Log
                    </button>
                    {carga.status === 'fallido' ? (
                      <button type="button" onClick={() => handleRetry(carga.id)}>
                        Reintentar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  {loading ? 'Cargando...' : 'No hay cargas registradas.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {log ? (
        <div className="admin-log-panel" role="dialog" aria-modal="true" aria-label="Log de carga">
          <div className="admin-log-toolbar">
            <strong>{log.title}</strong>
            <button type="button" onClick={() => setLog(null)}>
              Cerrar
            </button>
          </div>
          <pre>{log.text || 'Sin registros de log.'}</pre>
        </div>
      ) : null}
    </section>
  );
}

export default AdminCargasBD;
