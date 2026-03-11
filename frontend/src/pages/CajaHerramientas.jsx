import { useEffect, useState } from 'react';
import { getFormatos, getFormatoDownloadUrl } from '../services/api.js';
import { DOCUMENTO_AURORA_URL } from '../config/externalAssets.js';
import { reportError } from '../utils/reportError.js';

function CajaHerramientas() {
  const [formatos, setFormatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="card">
      <h2 className="center-title">Formatos para apoyar las solicitudes de atención jurídica</h2>

      {cargando && <p>Cargando...</p>}
      {error && <p className="hint-text">{error}</p>}

      {!cargando && (
        <div className="tools-grid">
          {formatos.map((f) => (
            <div key={f.id} className="tool-card">
              <a href={getFormatoDownloadUrl(f.id)} aria-label={`Descargar ${f.titulo}`}>
                <img className="tool-logo" src={DOCUMENTO_AURORA_URL} alt="Aurora" />
              </a>

              <div className="tool-title">{f.titulo}</div>

              <a className="tool-download" href={getFormatoDownloadUrl(f.id)}>
                Descargar
              </a>
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
