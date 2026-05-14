import { useEffect, useState } from 'react';
import { getFormatos, getFormatoDownloadTarget } from '../services/api.js';
import { DOCUMENTO_AURORA_URL } from '../config/externalAssets.js';
import { reportError } from '../utils/reportError.js';

function CajaHerramientas() {
  const [formatos, setFormatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [descargandoId, setDescargandoId] = useState('');

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError('');
      try {
        const data = await getFormatos();
        setFormatos(data);
      } catch (e) {
        reportError(e, 'caja-herramientas');
        setError('Error cargando formatos.');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  function abrirDescarga(downloadUrl) {
    const iframe = document.createElement('iframe');
    iframe.title = 'Descarga de formato';
    iframe.style.display = 'none';
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 60000);
  }

  async function descargarFormato(formato) {
    setDescargandoId(formato.id);
    setError('');
    try {
      const data = await getFormatoDownloadTarget(formato.id);
      abrirDescarga(data.downloadUrl);
    } catch (e) {
      reportError(e, 'descarga-formato');
      setError('Error preparando descarga.');
    } finally {
      setDescargandoId('');
    }
  }

  return (
    <div className="card">
      <h2 className="center-title">Formatos para apoyar las solicitudes de atención jurídica</h2>

      {cargando && <p>Cargando...</p>}
      {error && <p className="hint-text">{error}</p>}

      {!cargando && (
        <div className="tools-grid">
          {formatos.map((f) => (
            <div key={f.id} className="tool-card">
              <button
                type="button"
                className="tool-logo-button"
                onClick={() => descargarFormato(f)}
                aria-label={`Descargar ${f.titulo}`}
                disabled={descargandoId === f.id}
              >
                <img className="tool-logo" src={DOCUMENTO_AURORA_URL} alt="Aurora" />
              </button>

              <div className="tool-title" title={f.titulo}>
                {f.titulo}
              </div>

              <button
                type="button"
                className="tool-download"
                onClick={() => descargarFormato(f)}
                title={`Descargar ${f.titulo}`}
                disabled={descargandoId === f.id}
              >
                {descargandoId === f.id ? 'Abriendo...' : 'Descargar'}
              </button>
            </div>
          ))}

          {formatos.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
              No hay formatos para mostrar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CajaHerramientas;
