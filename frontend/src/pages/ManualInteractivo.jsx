import { MANUAL_VIDEO_URL } from '../config/externalAssets.js';

function ManualInteractivo() {
  const videoUrl = MANUAL_VIDEO_URL;

  return (
    <div className="card">
      <h2>Manual Interactivo</h2>

      <video controls src={videoUrl} style={{ width: '100%', borderRadius: '8px' }}>
        Tu navegador no soporta la reproducción de video.
      </video>
    </div>
  );
}

export default ManualInteractivo;
