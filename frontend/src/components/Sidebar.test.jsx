import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Sidebar from './Sidebar.jsx';

function renderSidebar(props = {}) {
  return renderToStaticMarkup(
    <Sidebar vistaActual="inicio" onChangeView={() => {}} {...props} />
  );
}

describe('Sidebar - acceso al reporte general', () => {
  it('oculta el reporte general para usuarios sin rol administrador', () => {
    expect(renderSidebar()).not.toContain('Reporte general de avance');
  });

  it('muestra el reporte general para usuarios administradores', () => {
    expect(renderSidebar({ showReporteGeneral: true })).toContain('Reporte general de avance');
  });
});
