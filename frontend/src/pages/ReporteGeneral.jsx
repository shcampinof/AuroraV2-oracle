import { useEffect, useState } from 'react';
import { getReporteGeneral } from '../services/api.js';
import './ReporteGeneral.css';

const STAGE_COLORS = ['#11368f', '#084ebd', '#0878dc', '#0798b5', '#099e96', '#258e4d', '#4b8e27'];

function StageIcon({ type }) {
  if (type === 'asignados') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="11" cy="11" r="4" /><circle cx="22" cy="12" r="3.5" />
        <path d="M3.5 26c.4-6 3.2-9 7.5-9s7.1 3 7.5 9M17 19c1.2-1.3 2.9-2 5-2 4 0 6.3 3 6.5 8" />
      </svg>
    );
  }
  if (type === 'analisis') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="7" y="5" width="18" height="23" rx="2" /><path d="M12 5V3h8v4h-8zM11 13h10M11 18h10M11 23h7" />
      </svg>
    );
  }
  if (type === 'procede') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 4v23M8 8h16M9 8l-5 9h10L9 8zm14 0-5 9h10l-5-9zM10 27h12" />
      </svg>
    );
  }
  if (type === 'entrevistas') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 7h22v15H15l-6 5v-5H5zM10 14h.1M16 14h.1M22 14h.1" />
      </svg>
    );
  }
  if (type === 'solicitan') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="13" cy="9" r="4" /><path d="M5 27c.5-7 3.2-11 8-11 2.1 0 3.8.7 5.1 2M19 24l3 3 6-8" />
      </svg>
    );
  }
  if (type === 'radicadas') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8 3h11l6 6v20H8zM19 3v7h6M12 15h9M12 20h9M12 25h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M12 5l8 8M9 8l8 8M5 25l12-12M17 5l10 10M21 20l6 6M17 26h12" />
    </svg>
  );
}

function formatCutoff(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return String(value || 'No disponible');
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
  }).format(new Date(`${year}-${month}-${day}T12:00:00-05:00`));
}

function formatGeneratedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota',
  }).format(date);
}

function normalizedPercentage(value, fractionDigits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** fractionDigits;
  return Math.round(number * factor) / factor;
}

function formatPercentage(value, fractionDigits = 0) {
  return normalizedPercentage(value, fractionDigits).toLocaleString('es-CO', {
    maximumFractionDigits: fractionDigits,
  });
}

function percentageOfTotal(stage, totalCount) {
  if (stage?.totalPercentage !== undefined && stage?.totalPercentage !== null) {
    return normalizedPercentage(stage.totalPercentage, 1);
  }
  if (!totalCount) return 0;
  return normalizedPercentage((Number(stage?.count || 0) / totalCount) * 100, 1);
}

function ReporteGeneral() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getReporteGeneral()
      .then((data) => {
        if (!active) return;
        setReport(data);
        setError('');
      })
      .catch((cause) => {
        if (active) setError(String(cause?.message || 'No fue posible cargar el reporte general.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <section className="general-report-state" aria-live="polite">Cargando el último corte diario…</section>;
  }

  if (error || !report) {
    return (
      <section className="general-report-state general-report-state--error" role="alert">
        <h2>Reporte general de avance</h2>
        <p>{error || 'El reporte general todavía no está disponible.'}</p>
      </section>
    );
  }

  const stages = Array.isArray(report.stages) ? report.stages : [];
  const metadata = report.metadata || {};
  const totalCount = Number(stages[0]?.count || report.resumen?.asignados || 0);

  return (
    <section className="general-report-page" aria-labelledby="general-report-title">
      <header className="general-report-header">
        <div>
          <h2 id="general-report-title">{metadata.titulo || 'Reporte general de avance AURORA 2.0'}</h2>
          <p><strong>{metadata.alcance || 'Consolidado nacional'}</strong><span aria-hidden="true"> | </span>Corte al {formatCutoff(metadata.corte)}</p>
        </div>
        <div className="general-report-freshness">
          <span>Última actualización</span>
          <strong>{formatGeneratedAt(metadata.generadoEn)}</strong>
          <small>Actualización automática diaria a las {metadata.actualizacionDiaria || '22:00'}</small>
        </div>
      </header>

      <p className="general-report-cache-note">
        Este tablero presenta el último corte consolidado; abrirlo no ejecuta consultas nuevas sobre la base de datos.
      </p>

      <div className="general-report-board">
        <div className="general-report-columns" aria-hidden="true">
          <span>Etapa del proceso</span><span>Número de usuarios</span><span>Avance de etapa / sobre total</span><span>Detalle / observaciones</span>
        </div>

        <div className="general-report-content">
          <div className="general-report-stages">
            {stages.map((stage, index) => {
              const color = STAGE_COLORS[index % STAGE_COLORS.length];
              const width = Math.max(58, 100 - index * 6);
              const stagePercentage = normalizedPercentage(stage.percentage);
              const totalPercentage = percentageOfTotal(stage, totalCount);
              return (
                <article className="general-report-stage" key={stage.key || stage.label} style={{ '--stage-color': color }}>
                  <div className="general-report-label">
                    <span className="general-report-icon"><StageIcon type={stage.key} /></span>
                    <strong>{stage.label}</strong>
                  </div>
                  <div className="general-report-funnel-cell">
                    <div className="general-report-funnel" style={{ '--stage-width': `${width}%` }}>
                      <strong>{Number(stage.count || 0).toLocaleString('es-CO')}</strong>
                      <span>{stage.shortLabel || stage.label}</span>
                    </div>
                  </div>
                  <div className="general-report-percentage">
                    <span className="general-report-line" />
                    <span className="general-report-percentage-values">
                      <strong><span>{formatPercentage(stagePercentage)} %</span><small>etapa</small></strong>
                      <strong><span>{formatPercentage(totalPercentage, 1)} %</span><small>total</small></strong>
                    </span>
                    <i />
                  </div>
                  <div className="general-report-details">
                    <p>{stage.detail}</p>
                    {stage.observation ? <p className="general-report-observation">{stage.observation}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="general-report-summary" aria-label="Resumen general">
            <h3>Resumen general</h3>
            {stages.map((stage, index) => {
              const stagePercentage = normalizedPercentage(stage.percentage);
              const totalPercentage = percentageOfTotal(stage, totalCount);
              return (
                <div className="general-report-summary-item" key={stage.key || stage.label} style={{ '--stage-color': STAGE_COLORS[index % STAGE_COLORS.length] }}>
                  <span className="general-report-icon"><StageIcon type={stage.key} /></span>
                  <p>
                    <strong>{Number(stage.count || 0).toLocaleString('es-CO')}</strong>
                    <span>{stage.shortLabel || stage.label}</span>
                    <small>Etapa: {formatPercentage(stagePercentage)} % · Total: {formatPercentage(totalPercentage, 1)} %</small>
                  </p>
                </div>
              );
            })}
          </aside>
        </div>
      </div>
    </section>
  );
}

export default ReporteGeneral;
