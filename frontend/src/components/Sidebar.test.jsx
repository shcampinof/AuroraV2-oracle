import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Sidebar from './Sidebar.jsx';
import { canAccessAssignments } from '../utils/assignmentAccess.js';

function renderSidebar(props = {}) {
  return renderToStaticMarkup(
    <Sidebar vistaActual="inicio" onChangeView={() => {}} {...props} />
  );
}

describe('Sidebar - reporte general eliminado', () => {
  it('no incluye el reporte general en la navegación de usuarios', () => {
    expect(renderSidebar()).not.toContain('Reporte general de avance');
  });

  it('no incluye el reporte general aun con todos los accesos habilitados', () => {
    const markup = renderSidebar({ showAdminCargas: true, showAdminUsuarios: true, showPag: true });
    expect(markup).not.toContain('Reporte general de avance');
    expect(markup).toContain('Descargar reporte de atención');
  });
  it.each(['pag', 'dndp', 'Aurora.DNDP'])('muestra la pestaña de asignación al rol %s', (role) => {
    expect(renderSidebar({ showPag: canAccessAssignments({ roles: [role] }) })).toContain('PAG - Asignación de casos');
  });
  it.each(['user', 'admin'])('conserva la restricción de asignación para %s sin PAG ni DNDP', (role) => {
    expect(renderSidebar({ showPag: canAccessAssignments({ roles: [role] }) })).not.toContain('PAG - Asignación de casos');
  });
});
