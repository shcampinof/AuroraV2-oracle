import { useEffect, useMemo, useState } from 'react';

import {
  deleteActuacionesCleanup,
  getActuacionesCleanupPreview,
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
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [cleanupConfirmation, setCleanupConfirmation] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDeleting, setCleanupDeleting] = useState(false);
  const [cleanupError, setCleanupError] = useState('');

  const hasRunningCarga = useMemo(
    () => cargas.some((carga) => RUNNING_STATUSES.has(carga.status)),
    [cargas]
  );

  async function refresh() {
    const [fuentesResult, cargasResult] = await Promise.allSettled([getCargaBdSources(), getCargasBd()]);
    if (fuentesResult.status === 'rejected') throw fuentesResult.reason;

    const fuentesData = fuentesResult.value;
    const nextFuentes = Array.isArray(fuentesData?.fuentes) ? fuentesData.fuentes : [];
    setFuentes(nextFuentes);
    setFuente((current) => current || nextFuentes.find((item) => item.enabled)?.id || '');

    if (cargasResult.status === 'fulfilled') {
      const cargasData = cargasResult.value;
      setCargas(Array.isArray(cargasData?.cargas) ? cargasData.cargas : []);
      return;
    }

    setCargas([]);
    throw cargasResult.reason;
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
    const form = event.currentTarget;
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
      form?.reset();
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

  async function loadCleanupPreview({ preserveError = false } = {}) {
    setCleanupLoading(true);
    setCleanupConfirmation('');
    if (!preserveError) setCleanupError('');
    try {
      const data = await getActuacionesCleanupPreview();
      setCleanupPreview(data?.preview || null);
    } catch (err) {
      setCleanupPreview(null);
      setCleanupError(String(err?.message || 'No fue posible consultar las actuaciones de prueba.'));
    } finally {
      setCleanupLoading(false);
    }
  }

  function handleOpenCleanup() {
    setCleanupOpen(true);
    setCleanupError('');
    loadCleanupPreview();
  }

  async function handleDeleteActuaciones() {
    if (!cleanupPreview?.totalActuaciones) return;
    setCleanupDeleting(true);
    setMessage('');
    setError('');
    try {
      const data = await deleteActuacionesCleanup({
        defensor: cleanupPreview.defensor,
        expectedCount: cleanupPreview.totalActuaciones,
        confirmation: cleanupConfirmation,
      });
      setMessage(data?.message || 'Actuaciones de prueba eliminadas.');
      setCleanupOpen(false);
      setCleanupPreview(null);
      setCleanupConfirmation('');
    } catch (err) {
      setCleanupError(String(err?.message || 'No fue posible eliminar las actuaciones de prueba.'));
      await loadCleanupPreview({ preserveError: true });
    } finally {
      setCleanupDeleting(false);
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
        <div className="admin-loads-header-actions">
          <button type="button" className="danger-outline-button" onClick={handleOpenCleanup}>
            Depurar actuaciones
          </button>
          <button type="button" className="secondary-button" onClick={() => refresh()} disabled={loading}>
            Actualizar
          </button>
        </div>
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
                    {carga.status === 'fallido' && carga.error ? (
                      <div className="load-error-text">{carga.error}</div>
                    ) : null}
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

      {cleanupOpen ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-cleanup-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cleanup-title"
          >
            <div className="admin-cleanup-toolbar">
              <div>
                <h3 id="cleanup-title">Depuración de actuaciones ficticias</h3>
                <p>Esta operación solo elimina actuaciones. No elimina personas, situaciones ni asignaciones.</p>
              </div>
              <button type="button" onClick={() => setCleanupOpen(false)} disabled={cleanupDeleting}>
                Cerrar
              </button>
            </div>

            <div className="admin-cleanup-content">
              {cleanupError ? <div className="status-banner status-banner--error">{cleanupError}</div> : null}
              {cleanupLoading ? <p>Consultando actuaciones...</p> : null}
              {!cleanupLoading && cleanupPreview ? (
                <>
                  <div className="admin-cleanup-summary">
                    <div><span>Defensor activo</span><strong>{cleanupPreview.defensor}</strong></div>
                    <div><span>Actuaciones</span><strong>{cleanupPreview.totalActuaciones}</strong></div>
                    <div><span>Personas relacionadas</span><strong>{cleanupPreview.totalPersonas}</strong></div>
                  </div>

                  {cleanupPreview.totalActuaciones ? (
                    <>
                      <div className="admin-cleanup-table-wrap">
                        <table className="admin-loads-table admin-cleanup-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Documento</th>
                              <th>Nombre</th>
                              <th>Fecha</th>
                              <th>Actuación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cleanupPreview.actuaciones.map((item) => (
                              <tr key={item.ID_GESTION}>
                                <td>{item.ID_GESTION}</td>
                                <td>{item.DOCUMENTO || '-'}</td>
                                <td>{item.NOMBRE || '-'}</td>
                                <td>{formatDate(item.FECHA_REGISTRO)}</td>
                                <td>{item.ACTUACION_ADELANTAR || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {cleanupPreview.truncated ? <p className="admin-cleanup-note">La vista previa muestra los primeros 500 registros.</p> : null}
                      <label className="admin-cleanup-confirmation">
                        Para confirmar, escriba <strong>{cleanupPreview.confirmation}</strong>
                        <input
                          type="text"
                          value={cleanupConfirmation}
                          onChange={(event) => setCleanupConfirmation(event.target.value)}
                          autoComplete="off"
                        />
                      </label>
                      <div className="admin-cleanup-actions">
                        <button type="button" className="secondary-button" onClick={() => loadCleanupPreview()} disabled={cleanupDeleting}>
                          Actualizar vista previa
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={handleDeleteActuaciones}
                          disabled={cleanupDeleting || cleanupConfirmation !== cleanupPreview.confirmation}
                        >
                          {cleanupDeleting ? 'Eliminando...' : `Eliminar ${cleanupPreview.totalActuaciones} actuaciones`}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="status-banner status-banner--ok">No hay actuaciones para depurar.</div>
                  )}
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default AdminCargasBD;
