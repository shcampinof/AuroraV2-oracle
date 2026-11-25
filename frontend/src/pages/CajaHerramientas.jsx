import { useEffect, useRef, useState } from 'react';
import { getFormatos, getFormatoDownloadTarget, guardarFormato, getCarpetasHerramientas, guardarCarpetaHerramientas, eliminarCarpetaHerramientas } from '../services/api.js';
import { DOCUMENTO_AURORA_URL } from '../config/externalAssets.js';
import { reportError } from '../utils/reportError.js';
import { normalizeFormatoDownloadUrl } from '../utils/formatoDownloadUrl.js';
import formatoColors from '../../../shared/formato-colors.json';

function colorTexto(color) {
  const channels = color.slice(1).match(/.{2}/g).map((hex) => {
    const value = parseInt(hex, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? '#000000' : '#ffffff';
}

function EditorFormato({ formato, carpetas, carpetaActual, guardando, onGuardar }) {
  const [titulo, setTitulo] = useState(formato?.titulo || '');
  const [color, setColor] = useState(() => formatoColors.find((option) => option.value === String(formato?.color || '').toLowerCase())?.value
    || (formato?.categoria === 'utilidad-publica' ? formatoColors[1].value : formatoColors[0].value));
  const [sourceUrl, setSourceUrl] = useState(formato?.sourceUrl || formato?.downloadUrl || '');
  const [carpetaId, setCarpetaId] = useState(formato ? formato.carpetaId || '' : carpetaActual || '');
  const [error, setError] = useState('');
  let downloadUrl = '';
  let urlError = '';
  if (sourceUrl.trim()) {
    try {
      downloadUrl = normalizeFormatoDownloadUrl(sourceUrl);
    } catch (e) {
      urlError = e.message;
    }
  }

  async function guardar(event) {
    event.preventDefault();
    if (guardando) return;
    setError('');
    try {
      await onGuardar({ titulo, color, sourceUrl, carpetaId: carpetaId || null }, formato?.id);
    } catch (e) {
      setError(e.message || 'No fue posible guardar el formato. Intente nuevamente.');
    }
  }

  return (
    <form className="tools-editor" onSubmit={guardar} aria-labelledby="tools-editor-title">
      <h3 id="tools-editor-title">{formato ? 'Editar ítem' : 'Nuevo ítem'}</h3>
      <fieldset disabled={guardando}>
        <div className="tools-editor-fields">
          <label htmlFor="formato-titulo">Título
            <input id="formato-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={250} />
          </label>
          <label htmlFor="formato-carpeta">Carpeta
            <select id="formato-carpeta" value={carpetaId} onChange={(e) => setCarpetaId(e.target.value)}>
              <option value="">Sin carpeta</option>
              {carpetas.map((carpeta) => <option key={carpeta.id} value={carpeta.id}>{carpeta.nombre}</option>)}
            </select>
          </label>
          <fieldset className="tools-color-picker">
            <legend>Color</legend>
            <div className="tools-color-options">
              {formatoColors.map((option) => (
                <label key={option.value} className="tools-color-choice">
                  <input type="radio" name="formato-color" value={option.value} checked={color === option.value} onChange={() => setColor(option.value)} />
                  <span className="tools-color-swatch" style={{ backgroundColor: option.value }} aria-hidden="true" />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="tools-editor-url" htmlFor="formato-url">Enlace del formato
            <input id="formato-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} required maxLength={4096} placeholder="https://..." aria-describedby="formato-url-storage formato-url-help formato-url-preview" />
          </label>
        </div>
        <p id="formato-url-storage" className="hint-text">
          Los formatos deben estar cargados en la{' '}
          <a href="https://defensoriadelpueblo.sharepoint.com/:f:/s/DNDP-DOCUMENTACION/IgCOKL63ljOORoNsaLdWykJTAeGVWSkVKvwwOlp5W2ruPWU?email=anjimenezc%40defensoria.gov.co&e=ALcMRF" target="_blank" rel="noopener noreferrer">carpeta de formatos en SharePoint</a>.
          {' '}Cargue allí el archivo y pegue aquí su enlace individual para añadirlo o actualizarlo.
        </p>
        <p id="formato-url-help" className="hint-text">Pegue el enlace del archivo. Para SharePoint y OneDrive (onedrive.live.com) se añade automáticamente download=1. Los demás enlaces se conservan.</p>
        <div id="formato-url-preview" className="tools-url-preview" aria-live="polite">
          <strong>URL de descarga generada</strong>
          {downloadUrl ? <output>{downloadUrl}</output> : <span>{urlError || 'Se completará al ingresar un enlace válido.'}</span>}
        </div>
        {error && <p role="alert" className="tools-editor-error">{error}</p>}
        <button className="primary-btn" type="submit" disabled={guardando || !downloadUrl || !titulo.trim()}>
          {guardando ? 'Guardando...' : formato ? 'Guardar cambios' : 'Añadir ítem'}
        </button>
      </fieldset>
    </form>
  );
}

function IconoCarpeta() {
  return (
    <svg className="tools-folder-icon" width="54" height="48" viewBox="0 0 54 48" fill="none" aria-hidden="true">
      <path d="M4 12a3 3 0 0 1 3-3h14l5 5h21a3 3 0 0 1 3 3v24H4V12Z" fill="#ffe79a" stroke="#a97614" strokeWidth="2" />
      <path d="M15 4h23v30H15z" fill="#fff" stroke="#2563a6" strokeWidth="2" />
      <path d="M21 10h23v28H21z" fill="#fff" stroke="#2563a6" strokeWidth="2" />
      <path d="M26 16h13M26 21h13M26 26h13" stroke="#e57480" strokeWidth="3" />
      <path d="M4 24h16l4 4h26v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V24Z" fill="#ffd34e" stroke="#a97614" strokeWidth="2" />
    </svg>
  );
}

function EditorCarpeta({ carpeta, carpetas, formatos, guardando, onGuardar, onEliminar }) {
  const [nombre, setNombre] = useState(carpeta?.nombre || '');
  const [formatoIds, setFormatoIds] = useState(() => formatos.filter((f) => carpeta && f.carpetaId === carpeta.id).map((f) => f.id));
  const [error, setError] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  async function guardar(event) {
    event.preventDefault();
    if (guardando) return;
    setError('');
    try {
      await onGuardar({ nombre, formatoIds }, carpeta?.id);
    } catch (e) {
      setError(e.message || 'No fue posible guardar la carpeta. Intente nuevamente.');
    }
  }

  async function eliminar() {
    if (guardando) return;
    setError('');
    try {
      await onEliminar(carpeta.id);
    } catch (e) {
      setError(e.message || 'No fue posible eliminar la carpeta. Intente nuevamente.');
    }
  }

  return (
    <form className="tools-editor" onSubmit={guardar} aria-labelledby="tools-folder-editor-title">
      <h3 id="tools-folder-editor-title">{carpeta ? 'Editar carpeta' : 'Nueva carpeta'}</h3>
      <fieldset disabled={guardando}>
        <label htmlFor="carpeta-nombre">Nombre de la carpeta
          <input id="carpeta-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required />
        </label>
        <fieldset className="tools-folder-items">
          <legend>Formularios y documentos de esta carpeta</legend>
          <p className="hint-text">Marque los ítems que desea agrupar. Los que estén en otra carpeta se moverán aquí. Al desmarcarlos quedarán en «Sin carpeta».</p>
          <div className="tools-folder-options">
            {formatos.map((formato) => (
              <label key={formato.id} className="tools-folder-choice">
                <input type="checkbox" checked={formatoIds.includes(formato.id)} onChange={(e) => setFormatoIds((actuales) => e.target.checked ? [...actuales, formato.id] : actuales.filter((id) => id !== formato.id))} />
                <span>{formato.titulo}<small>{carpetas.find((item) => item.id === formato.carpetaId)?.nombre || 'Sin carpeta'}</small></span>
              </label>
            ))}
          </div>
          {formatos.length === 0 && <p>Aún no hay ítems. Puede añadirlos después de crear la carpeta.</p>}
        </fieldset>
        {error && <p role="alert" className="tools-editor-error">{error}</p>}
        <div className="tools-folder-actions">
          <button type="submit" className="primary-btn" disabled={guardando || !nombre.trim()}>{guardando ? 'Guardando...' : carpeta ? 'Guardar carpeta' : 'Crear carpeta'}</button>
          {carpeta && !confirmandoEliminar && <button type="button" onClick={() => setConfirmandoEliminar(true)}>Eliminar carpeta</button>}
        </div>
        {confirmandoEliminar && (
          <div className="tools-folder-delete">
            <p>Se eliminará la carpeta «{carpeta.nombre}». Sus formularios y documentos se conservarán en «Sin carpeta».</p>
            <div className="tools-folder-actions">
              <button type="button" onClick={eliminar}>Eliminar y conservar ítems</button>
              <button type="button" onClick={() => setConfirmandoEliminar(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </fieldset>
    </form>
  );
}

function CajaHerramientas({ puedeEditar = false }) {
  const [formatos, setFormatos] = useState([]);
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaActualId, setCarpetaActualId] = useState(null);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState(null);
  const [tipoEditor, setTipoEditor] = useState('item');
  const [cargando, setCargando] = useState(true);
  const [catalogoCargado, setCatalogoCargado] = useState(false);
  const [error, setError] = useState('');
  const [descargandoId, setDescargandoId] = useState('');
  const [editando, setEditando] = useState(false);
  const [formatoSeleccionado, setFormatoSeleccionado] = useState(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const editorRef = useRef(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError('');
      try {
        const [data, carpetasData] = await Promise.all([getFormatos(), getCarpetasHerramientas()]);
        setFormatos(data);
        setCarpetas(carpetasData);
        setCatalogoCargado(true);
      } catch (e) {
        reportError(e, 'caja-herramientas');
        setError('Error cargando formatos.');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  function seleccionarFormato(formato) {
    setTipoEditor('item');
    setFormatoSeleccionado(formato);
    setEditorVersion((version) => version + 1);
    setMensaje('');
    requestAnimationFrame(() => editorRef.current?.querySelector('input')?.focus());
  }

  function seleccionarCarpeta(carpeta) {
    setTipoEditor('carpeta');
    setCarpetaSeleccionada(carpeta);
    setEditorVersion((version) => version + 1);
    setMensaje('');
    requestAnimationFrame(() => editorRef.current?.querySelector('input')?.focus());
  }

  function abrirCarpeta(id) {
    setCarpetaActualId(id);
    seleccionarFormato(null);
  }

  async function guardarCarpeta(datos, id) {
    if (!puedeEditar) return;
    setGuardando(true);
    setMensaje('');
    try {
      const data = await guardarCarpetaHerramientas(datos, id);
      setCarpetas(data.carpetas);
      setFormatos(data.formatos);
      setCarpetaSeleccionada(data.carpeta);
      setCarpetaActualId(data.carpeta.id);
      setEditorVersion((version) => version + 1);
      setMensaje(id ? 'Carpeta actualizada correctamente.' : 'Carpeta creada correctamente.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCarpeta(id) {
    if (!puedeEditar) return;
    setGuardando(true);
    setMensaje('');
    try {
      const data = await eliminarCarpetaHerramientas(id);
      setCarpetas(data.carpetas);
      setFormatos(data.formatos);
      setCarpetaActualId(null);
      seleccionarFormato(null);
      setMensaje('Carpeta eliminada. Sus ítems se conservaron en «Sin carpeta».');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarItem(datos, id) {
    if (!puedeEditar) return;
    setGuardando(true);
    setMensaje('');
    try {
      const formato = await guardarFormato(datos, id);
      setFormatos((actuales) => id ? actuales.map((item) => item.id === id ? formato : item) : [...actuales, formato]);
      setFormatoSeleccionado(formato);
      setCarpetaActualId(formato.carpetaId || null);
      setEditorVersion((version) => version + 1);
      setMensaje(id ? 'Ítem actualizado correctamente.' : 'Ítem añadido correctamente.');
    } finally {
      setGuardando(false);
    }
  }

  async function descargarFormato(formato) {
    setDescargandoId(formato.id);
    setError('');
    try {
      const data = await getFormatoDownloadTarget(formato.id);
      const enlace = document.createElement('a');
      enlace.href = data.downloadUrl;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    } catch (e) {
      reportError(e, 'descarga-formato');
      setError('Error preparando descarga.');
    } finally {
      setDescargandoId('');
    }
  }

  const carpetaActual = carpetas.find((carpeta) => carpeta.id === carpetaActualId);
  const formatosVisibles = formatos.filter((formato) => (formato.carpetaId || null) === (carpetaActual?.id || null));

  return (
    <div className="card">
      <h2 className="center-title">Formatos para apoyar las solicitudes de atención jurídica</h2>

      {puedeEditar && catalogoCargado && (
        <div className="tools-admin-actions">
          <button type="button" className="secondary-btn" aria-expanded={editando} aria-controls="tools-admin-editor" disabled={guardando} onClick={() => setEditando(!editando)}>
            {editando ? 'Terminar edición' : 'Editar caja de herramientas'}
          </button>
          {editando && <button type="button" className="primary-btn" disabled={guardando} onClick={() => seleccionarFormato(null)}>Nuevo ítem</button>}
          {editando && <button type="button" className="primary-btn" disabled={guardando} onClick={() => seleccionarCarpeta(null)}>Nueva carpeta</button>}
        </div>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
      {puedeEditar && editando && (
        <div id="tools-admin-editor" ref={editorRef}>
          {tipoEditor === 'carpeta' ? (
            <EditorCarpeta key={`carpeta-${editorVersion}`} carpeta={carpetaSeleccionada} carpetas={carpetas} formatos={formatos} guardando={guardando} onGuardar={guardarCarpeta} onEliminar={eliminarCarpeta} />
          ) : (
            <EditorFormato key={`${formatoSeleccionado?.id || 'nuevo'}-${editorVersion}`} formato={formatoSeleccionado} carpetas={carpetas} carpetaActual={carpetaActualId} guardando={guardando} onGuardar={guardarItem} />
          )}
        </div>
      )}

      {cargando && <p>Cargando...</p>}
      {error && <p className="hint-text">{error}</p>}

      {!cargando && (
        <>
        {carpetas.length > 0 && (
          <nav className="tools-breadcrumb" aria-label="Ubicación en caja de herramientas">
            <button type="button" disabled={guardando || !carpetaActual} onClick={() => abrirCarpeta(null)}>Caja de herramientas</button>
            {carpetaActual && <><span aria-hidden="true">/</span><span aria-current="page">{carpetaActual.nombre}</span></>}
          </nav>
        )}
        {!carpetaActual && carpetas.length > 0 && (
          <section aria-label="Carpetas">
            <h3>Carpetas</h3>
            <div className="tools-folders-grid">
              {carpetas.map((carpeta) => {
                const cantidad = formatos.filter((formato) => formato.carpetaId === carpeta.id).length;
                return (
                  <div key={carpeta.id} className="tools-folder-card">
                    <button type="button" className="tools-folder-open" disabled={guardando} onClick={() => abrirCarpeta(carpeta.id)} aria-label={`Abrir carpeta ${carpeta.nombre}`}>
                      <IconoCarpeta />
                      <span><strong>{carpeta.nombre}</strong><small>{cantidad} {cantidad === 1 ? 'ítem' : 'ítems'}</small></span>
                    </button>
                    {puedeEditar && editando && <button type="button" className="tool-edit" disabled={guardando} onClick={() => seleccionarCarpeta(carpeta)} aria-label={`Editar carpeta ${carpeta.nombre}`}>Editar carpeta</button>}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {carpetaActual && (
          <div className="tools-folder-heading">
            <h3>{carpetaActual.nombre}</h3>
            {puedeEditar && editando && <button type="button" className="tool-edit" disabled={guardando} onClick={() => seleccionarCarpeta(carpetaActual)}>Editar carpeta</button>}
          </div>
        )}
        {!carpetaActual && carpetas.length > 0 && <h3>Sin carpeta</h3>}
        <div className="tools-grid">
          {formatosVisibles.map((f) => (
            <div
              key={f.id}
              className={`tool-card ${/^#[0-9a-f]{6}$/i.test(f.color || '') ? 'tool-card--custom' : ''} ${
                f.categoria === 'utilidad-publica'
                  ? 'tool-card--utilidad-publica'
                  : 'tool-card--general'
              }`}
              style={/^#[0-9a-f]{6}$/i.test(f.color || '') ? {
                '--tool-accent': f.color,
                '--tool-surface': `color-mix(in srgb, ${f.color} 4%, white)`,
                '--tool-surface-hover': `color-mix(in srgb, ${f.color} 8%, white)`,
                '--tool-action-text': colorTexto(f.color),
              } : undefined}
            >
              <button
                type="button"
                className="tool-logo-button"
                onClick={() => descargarFormato(f)}
                aria-label={`Descargar ${f.titulo}`}
                disabled={descargandoId === f.id}
              >
                <img className="tool-logo" src={DOCUMENTO_AURORA_URL} alt="Aurora" />
              </button>
              {puedeEditar && editando && (
                <button type="button" className="tool-edit" disabled={guardando} aria-label={`Editar ${f.titulo}`} onClick={() => seleccionarFormato(f)}>Editar</button>
              )}

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

          {formatosVisibles.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
              {carpetaActual ? 'Esta carpeta aún no tiene formularios ni documentos.' : carpetas.length > 0 ? 'No hay ítems sin carpeta.' : 'No hay formatos para mostrar.'}
            </p>
          )}
        </div>
        </>
      )}
    </div>
  );
}

export default CajaHerramientas;
