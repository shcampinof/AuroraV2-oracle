import { FEATURE_FLAGS } from '../config/featureFlags.js';

const items = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'formulario', label: 'Formulario de atención' },
  { id: 'registros', label: 'Usuarios asignados' },
  { id: 'asignacion', label: 'PAG - Asignación de casos de condenados' },
  { id: 'herramientas', label: 'Caja de Herramientas' },
  { id: 'manual', label: 'Manual Interactivo', enabled: FEATURE_FLAGS.manualInteractivo },
  { id: 'admin-cargas', label: 'Cargas mensuales', adminOnly: true },
  { id: 'admin-usuarios', label: 'Usuarios autorizados', userAdminOnly: true },
];

function Sidebar({ vistaActual, onChangeView, showAdminCargas = false, showAdminUsuarios = false }) {
  const visibleItems = items.filter((item) => {
    if (item.enabled === false) return false;
    if (item.adminOnly && !showAdminCargas) return false;
    if (item.userAdminOnly && !showAdminUsuarios) return false;
    return true;
  });

  return (
    <aside className="sidebar">
      {visibleItems.map((it) => (
        <button
          key={it.id}
          className={`sidebar-button ${vistaActual === it.id ? 'active' : ''}`}
          aria-current={vistaActual === it.id ? 'page' : undefined}
          onClick={() => onChangeView(it.id)}
        >
          {it.label}
        </button>
      ))}
    </aside>
  );
}

export default Sidebar;
