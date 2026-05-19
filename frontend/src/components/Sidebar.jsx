const items = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'formulario', label: 'Formulario de atención' },
  { id: 'registros', label: 'Usuarios asignados' },
  { id: 'asignacion', label: 'PAG - Asignación de casos de condenados' },
  { id: 'herramientas', label: 'Caja de Herramientas' },
  { id: 'manual', label: 'Manual Interactivo' },
  { id: 'admin-cargas', label: 'Cargas mensuales', adminOnly: true },
];

function Sidebar({ vistaActual, onChangeView, showAdminCargas = false }) {
  const visibleItems = items.filter((item) => !item.adminOnly || showAdminCargas);

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
