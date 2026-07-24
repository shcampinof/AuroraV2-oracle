import { useState } from 'react';
import { MANUAL_VIDEOS } from '../config/externalAssets.js';

function ManualInteractivo() {
  const [selectedVideoId, setSelectedVideoId] = useState(MANUAL_VIDEOS[0].id);
  const selectedVideo =
    MANUAL_VIDEOS.find((video) => video.id === selectedVideoId) || MANUAL_VIDEOS[0];

  return (
    <section className="card manual-interactivo" aria-labelledby="manual-interactivo-title">
      <header className="manual-interactivo-header">
        <h2 id="manual-interactivo-title">Manual Interactivo</h2>
        <p>Da clic en tu rol para consultar el tutorial.</p>
      </header>

      <div className="manual-video-selector" aria-label="Tutoriales disponibles">
        {MANUAL_VIDEOS.map((video) => {
          const isSelected = video.id === selectedVideo.id;

          return (
            <button
              key={video.id}
              type="button"
              className={`manual-video-option${isSelected ? ' is-selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => setSelectedVideoId(video.id)}
            >
              <span className="manual-video-option-icon" aria-hidden="true">
                ▶
              </span>
              {video.title}
            </button>
          );
        })}
      </div>

      <div className="manual-video-player">
        <video
          key={selectedVideo.id}
          src={selectedVideo.videoUrl}
          controls
          preload="metadata"
          playsInline
          aria-label={`Video tutorial ${selectedVideo.title}`}
        >
          Tu navegador no soporta la reproducción de video.
        </video>
      </div>
    </section>
  );
}

export default ManualInteractivo;
