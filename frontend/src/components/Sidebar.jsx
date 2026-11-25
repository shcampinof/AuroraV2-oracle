import { useState } from 'react';
import { FEATURE_FLAGS } from '../config/featureFlags.js';

const items = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'formulario', label: 'Formulario de atención' },
  { id: 'registros', label: 'Usuarios asignados' },
  { id: 'reporte-atenciones', label: 'Descargar reporte de atención' },
  { id: 'asignacion', label: 'PAG - Asignación de casos de condenados', pagOnly: true },
  { id: 'herramientas', label: 'Caja de Herramientas' },
  { id: 'manual', label: 'Manual Interactivo', enabled: FEATURE_FLAGS.manualInteractivo },
  { id: 'admin-cargas', label: 'Cargas mensuales', adminOnly: true },
  { id: 'admin-usuarios', label: 'Usuarios autorizados', userAdminOnly: true },
];

function Sidebar({
  vistaActual,
  onChangeView,
  showAdminCargas = false,
  showAdminUsuarios = false,
  showPag = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = items.filter((item) => {
    if (item.enabled === false) return false;
    if (item.pagOnly && !showPag) return false;
    if (item.adminOnly && !showAdminCargas) return false;
    if (item.userAdminOnly && !showAdminUsuarios) return false;
    return true;
  });

  return (
    <aside className="sidebar">
      <button type="button" className="sidebar-toggle" aria-expanded={expanded} aria-controls="aurora-navigation"
        onClick={() => setExpanded((value) => !value)}>
        <span>Menú</span>
        <span className="sidebar-current">{visibleItems.find((item) => item.id === vistaActual)?.label}</span>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      <nav id="aurora-navigation" className="sidebar-links" aria-label="Navegación principal" data-expanded={expanded}>
      {visibleItems.map((it) => (
        <button
          key={it.id}
          className={`sidebar-button ${vistaActual === it.id ? 'active' : ''}`}
          aria-current={vistaActual === it.id ? 'page' : undefined}
          onClick={() => { setExpanded(false); onChangeView(it.id); }}
        >
          {it.label}
        </button>
      ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
