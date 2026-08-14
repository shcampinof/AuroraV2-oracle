import { useEffect, useState } from 'react';
import { getReporteAtencionesDefensores, getReporteAtencionesOpciones } from '../services/api.js';
import { downloadReporteAtencionesPdf, formatReportDate } from '../utils/reporteAtencionesPdf.js';

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { fechaInicio: `${year}-${month}-01`, fechaFin: `${year}-${month}-${day}` };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function ReporteAtencionesDefensores({ user }) {
  const [filters, setFilters] = useState(() => ({
    ...currentMonthRange(),
    regional: '',
    defensorId: '',
    defensorNombre: '',
    defensorBusqueda: '',
  }));
  const [defensores, setDefensores] = useState([]);
  const [regionales, setRegionales] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    let alive = true;
    getReporteAtencionesOpciones()
      .then((data) => {
        if (!alive) return;
        const options = (Array.isArray(data?.defensores) ? data.defensores : [])
          .map((item) => ({
            id: String(item?.id || '').trim(),
            nombre: String(item?.nombre || '').trim(),
            label: String(item?.label || item?.nombre || '').trim(),
            regional: String(item?.regional || '').trim(),
            correo: String(item?.correo || '').trim(),
          }))
          .filter((item) => item.id && item.nombre && item.label)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        setDefensores(options);
        setRegionales(
          (Array.isArray(data?.regionales) ? data.regionales : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'es'))
        );

        const userName = normalizeText(user?.name);
        const userEmail = normalizeText(user?.email || user?.username);
        const match = options.find((item) =>
          (userEmail && normalizeText(item.correo) === userEmail) ||
          (userName && normalizeText(item.nombre) === userName)
        );
        if (match) {
          setFilters((current) => ({
            ...current,
            regional: match.regional,
            defensorId: match.id,
            defensorNombre: match.nombre,
            defensorBusqueda: match.label,
          }));
        }
      })
      .catch((cause) => {
        if (alive) setError(String(cause?.message || 'No fue posible cargar el catálogo de defensores.'));
      })
      .finally(() => {
        if (alive) setLoadingCatalog(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const filteredDefensores = defensores;

  const updateFilter = (key, value) => {
    setReport(null);
    setError('');
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateDefensorSearch = (value) => {
    setReport(null);
    setError('');
    const normalizedValue = normalizeText(value);
    const exactMatches = filteredDefensores.filter((item) => normalizeText(item.label) === normalizedValue);
    setFilters((current) => ({
      ...current,
      defensorBusqueda: value,
      defensorId: exactMatches.length === 1 ? exactMatches[0].id : '',
      defensorNombre: exactMatches.length === 1 ? exactMatches[0].nombre : '',
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!filters.regional || !filters.defensorId || !filters.fechaInicio || !filters.fechaFin) {
      setError(
        filters.defensorBusqueda && !filters.defensorId
          ? 'Seleccione un defensor de las sugerencias del buscador.'
          : 'Complete la regional, el defensor y las dos fechas del reporte.'
      );
      return;
    }
    if (filters.fechaInicio > filters.fechaFin) {
      setError('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    setLoadingReport(true);
    try {
      setReport(await getReporteAtencionesDefensores(filters));
    } catch (cause) {
      setError(String(cause?.message || 'No fue posible generar el reporte.'));
    } finally {
      setLoadingReport(false);
    }
  };

  const download = async () => {
    if (!report) return;
    setError('');
    setDownloading(true);
    try {
      await downloadReporteAtencionesPdf(report);
    } catch (cause) {
      setError(String(cause?.message || 'No fue posible descargar el PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  const summaryCards = report
    ? [
        ['Casos analizados', report.resumen.casosAnalizados],
        ['Entrevistas', report.resumen.entrevistasRealizadas],
        ['Solicitudes', report.resumen.solicitudesPresentadas],
        ['Reiteraciones', report.resumen.reiteracionesPresentadas],
        ['Recursos', report.resumen.recursosPresentados],
        ['Casos cerrados', report.resumen.casosCerrados],
        ['Total actuaciones', report.resumen.totalActuaciones],
        ['Personas activas con gestión', report.resumen.personasActivasConGestion],
      ]
    : [];

  return (
    <section className="report-attentions-page">
      <header className="report-attentions-header">
        <div>
          <h2>Reporte atenciones defensores</h2>
          <p>Genere el informe de gestión jurídica del defensor para el periodo seleccionado.</p>
        </div>
      </header>

      <form className="report-attentions-form" onSubmit={submit}>
        <label>
          <span>Defensoría Regional</span>
          <select
            value={filters.regional}
            onChange={(event) => updateFilter('regional', event.target.value)}
            disabled={loadingCatalog}
            required
          >
            <option value="">Seleccione una regional</option>
            {regionales.map((regional) => <option key={regional} value={regional}>{regional}</option>)}
          </select>
        </label>
        <label>
          <span>Defensor(a) Público(a)</span>
          <input
            type="text"
            list="reporte-defensores-list"
            value={filters.defensorBusqueda}
            onChange={(event) => updateDefensorSearch(event.target.value)}
            disabled={loadingCatalog}
            placeholder="Escriba parte del nombre"
            autoComplete="off"
            required
          />
          <datalist id="reporte-defensores-list">
            {filteredDefensores.map((defensor) => (
              <option key={defensor.id} value={defensor.label} />
            ))}
          </datalist>
        </label>
        <label>
          <span>Fecha inicio reporte</span>
          <input
            type="date"
            value={filters.fechaInicio}
            max={filters.fechaFin || undefined}
            onChange={(event) => updateFilter('fechaInicio', event.target.value)}
            required
          />
        </label>
        <label>
          <span>Fecha final reporte</span>
          <input
            type="date"
            value={filters.fechaFin}
            min={filters.fechaInicio || undefined}
            onChange={(event) => updateFilter('fechaFin', event.target.value)}
            required
          />
        </label>
        <button className="primary-button report-attentions-submit" type="submit" disabled={loadingCatalog || loadingReport}>
          {loadingReport ? 'Consultando información…' : 'Generar reporte'}
        </button>
      </form>

      {error ? <div className="status-banner status-banner--error" role="alert">{error}</div> : null}
      {!loadingCatalog && defensores.length === 0 ? (
        <div className="status-banner status-banner--error" role="alert">
          No hay defensores con actuaciones registradas.
        </div>
      ) : null}

      {report ? (
        <section className="report-attentions-preview" aria-live="polite">
          <div className="report-attentions-preview-header">
            <div>
              <h3>Reporte listo</h3>
              <p>
                {report.metadata.defensor} · {report.metadata.regional} · {formatReportDate(report.metadata.fechaInicio)} al {formatReportDate(report.metadata.fechaFin)}
              </p>
            </div>
            <button className="primary-button" type="button" onClick={download} disabled={downloading}>
              {downloading ? 'Preparando PDF…' : 'Descargar PDF'}
            </button>
          </div>
          <div className="report-attentions-summary">
            {summaryCards.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <p className="report-attentions-note">
            El PDF incluye los conteos completos, los cinco detalles de actuaciones y el estado actual de los casos asignados.
          </p>
        </section>
      ) : null}
    </section>
  );
}

export default ReporteAtencionesDefensores;
