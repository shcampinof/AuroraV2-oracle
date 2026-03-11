const items = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'formulario', label: 'Formulario de atención' },
  { id: 'registros', label: 'Usuarios asignados' },
  { id: 'asignacion', label: 'PAG - Asignación de Casos' },
  { id: 'herramientas', label: 'Caja de Herramientas' },
  { id: 'manual', label: 'Manual Interactivo' },
];

function Sidebar({ vistaActual, onChangeView }) {
  return (
    <aside className="sidebar">
      {items.map((it) => (
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
