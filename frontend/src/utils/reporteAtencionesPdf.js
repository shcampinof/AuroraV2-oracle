import { LOGO_AURORA_URL, LOGO_DEFENSORIA_URL } from '../config/externalAssets.js';

const BLUE = [47, 100, 173];
const DARK_BLUE = [7, 71, 148];
const LIGHT_BLUE = [237, 243, 251];
const BORDER = [183, 195, 209];
const TEXT = [31, 43, 55];

export function formatReportDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

export function sanitizeReportFilePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'defensor';
}

function imageUrlToDataUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('No fue posible preparar los logos institucionales.'));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('No fue posible cargar los logos institucionales.'));
    image.src = url;
  });
}

function addCell(pdf, text, x, y, width, height, options = {}) {
  const fill = options.fill;
  if (fill) {
    pdf.setFillColor(...fill);
    pdf.rect(x, y, width, height, 'F');
  }
  pdf.setDrawColor(...(options.border || BORDER));
  pdf.rect(x, y, width, height);
  pdf.setTextColor(...(options.color || TEXT));
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(options.size || 8);
  const lines = pdf.splitTextToSize(String(text ?? ''), Math.max(8, width - 8));
  const lineHeight = options.lineHeight || 9.5;
  const textHeight = lines.length * lineHeight;
  const textY = options.alignTop ? y + 11 : y + Math.max(11, (height - textHeight) / 2 + 8);
  pdf.text(lines, x + 4, textY, { baseline: 'alphabetic' });
}

function rowHeight(pdf, values, widths, fontSize = 7.5) {
  pdf.setFontSize(fontSize);
  const maxLines = values.reduce((max, value, index) => {
    const lines = pdf.splitTextToSize(String(value ?? ''), Math.max(8, widths[index] - 8));
    return Math.max(max, lines.length);
  }, 1);
  return Math.max(21, maxLines * 9 + 8);
}

function buildDocument(pdf, report, logos) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;
  const bottom = 36;
  let y = 28;

  const newPage = () => {
    pdf.addPage();
    y = 34;
  };

  const ensureSpace = (height) => {
    if (y + height <= pageHeight - bottom) return;
    newPage();
  };

  const centeredText = (text, size, style = 'normal', color = TEXT) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, contentWidth - 120);
    pdf.text(lines, pageWidth / 2, y, { align: 'center' });
    y += lines.length * (size + 2);
  };

  if (logos.defensoria) pdf.addImage(logos.defensoria, 'PNG', margin + 4, 24, 38, 45);
  if (logos.aurora) pdf.addImage(logos.aurora, 'PNG', pageWidth - margin - 58, 28, 54, 35);
  y = 31;
  centeredText('INFORME DE GESTIÓN DE ATENCIÓN JURÍDICA A PERSONAS PRIVADAS DE LA LIBERTAD', 11, 'bold', DARK_BLUE);
  centeredText('DIRECCIÓN NACIONAL DE DEFENSORÍA PÚBLICA', 10, 'bold', DARK_BLUE);
  y = Math.max(y + 10, 83);

  const metadataRows = [
    ['Defensoría Regional', report.metadata.regional],
    ['Defensor(a) Público(a)', report.metadata.defensor],
    ['Periodo analizado', ''],
    ['Fecha inicio reporte', formatReportDate(report.metadata.fechaInicio)],
    ['Fecha final reporte', formatReportDate(report.metadata.fechaFin)],
  ];
  const metaLeft = 150;
  metadataRows.forEach(([label, value]) => {
    addCell(pdf, label, margin, y, metaLeft, 21, { bold: true, fill: LIGHT_BLUE, size: 8.5 });
    addCell(pdf, value, margin + metaLeft, y, contentWidth - metaLeft, 21, { size: 8.5 });
    y += 21;
  });

  const sectionTitle = (title) => {
    ensureSpace(34);
    y += 12;
    addCell(pdf, title, margin, y, contentWidth, 23, { bold: true, fill: DARK_BLUE, color: [255, 255, 255], size: 9 });
    y += 23;
  };

  sectionTitle('REPORTE GENERAL DEL PERÍODO SELECCIONADO');
  const summaryRows = [
    ['1. Conteo total de actuaciones adelantadas en el periodo', ''],
    ['1.1. Número de casos analizados', report.resumen.casosAnalizados],
    ['1.2. Número de entrevistas realizadas', report.resumen.entrevistasRealizadas],
    ['1.3. Número de solicitudes presentadas', report.resumen.solicitudesPresentadas],
    ['1.4. Número de reiteraciones presentadas', report.resumen.reiteracionesPresentadas],
    ['1.5. Número de recursos presentados', report.resumen.recursosPresentados],
    ['1.6. Número de casos cerrados durante el periodo', report.resumen.casosCerrados],
    ['1.7. Número total de actuaciones adelantadas en el periodo', report.resumen.totalActuaciones],
    ['2. Conteo total de personas con actuaciones durante el periodo', ''],
    ['2.1. Número de personas asignadas al defensor público', report.resumen.personasAsignadas],
    ['2.2. Número de personas activas (asignadas que aún no se han cerrado)', report.resumen.personasActivas],
    ['2.3. Número de personas activas que reportan alguna gestión de atención jurídica durante el periodo', report.resumen.personasActivasConGestion],
    ['2.4. Número de personas a quienes se les cerró el caso durante el periodo', report.resumen.personasConCasoCerrado],
  ];
  summaryRows.forEach(([label, value], index) => {
    const heading = index === 0 || index === 8;
    const height = rowHeight(pdf, [label, value], [contentWidth - 72, 72], 8);
    ensureSpace(height);
    addCell(pdf, label, margin, y, contentWidth - 72, height, {
      bold: true,
      fill: heading ? LIGHT_BLUE : undefined,
      size: 8,
    });
    addCell(pdf, value, margin + contentWidth - 72, y, 72, height, {
      bold: true,
      fill: heading ? LIGHT_BLUE : [228, 246, 235],
      size: 9,
    });
    y += height;
  });

  const detailTable = (title, rows, lastHeader) => {
    const widths = [contentWidth * 0.27, contentWidth * 0.17, contentWidth * 0.34, contentWidth * 0.22];
    const headers = ['Nombre del usuario', 'Identificación', 'Lugar de privación de la libertad', lastHeader];
    const drawHeader = () => {
      ensureSpace(28);
      let x = margin;
      headers.forEach((header, index) => {
        addCell(pdf, header, x, y, widths[index], 28, { bold: true, fill: BLUE, color: [255, 255, 255], size: 7 });
        x += widths[index];
      });
      y += 28;
    };

    sectionTitle(title);
    drawHeader();
    const safeRows = rows.length
      ? rows.map((row) => [row.nombre, row.identificacion, row.lugarPrivacion, row.fecha ? formatReportDate(row.fecha) : row.estado])
      : [['Sin registros en el periodo seleccionado', '', '', '']];
    safeRows.forEach((values) => {
      const height = rowHeight(pdf, values, widths);
      if (y + height > pageHeight - bottom) {
        newPage();
        drawHeader();
      }
      let x = margin;
      values.forEach((value, index) => {
        addCell(pdf, value, x, y, widths[index], height, { alignTop: true, size: 7.5 });
        x += widths[index];
      });
      y += height;
    });
  };

  detailTable('Detalle de casos analizados (1.1.)', report.detalles.casosAnalizados, 'Fecha de análisis jurídico del caso');
  detailTable('Detalle de entrevistas realizadas (1.2.)', report.detalles.entrevistas, 'Fecha de entrevista');
  detailTable('Detalle de solicitudes presentadas (1.3.)', report.detalles.solicitudes, 'Fecha de presentación de la solicitud');
  detailTable('Detalle de reiteraciones presentadas (1.4.)', report.detalles.reiteraciones, 'Fecha de reiteración');
  detailTable('Detalle de recursos presentados (1.5.)', report.detalles.recursos, 'Fecha de presentación del recurso');
  detailTable('Estado actual de los casos asignados', report.detalles.casosAsignados, 'Estado');

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER);
    pdf.line(margin, pageHeight - 26, pageWidth - margin, pageHeight - 26);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(90, 103, 117);
    pdf.text('Sistema AURORA · Defensoría del Pueblo', margin, pageHeight - 14);
    pdf.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
  }
}

export async function downloadReporteAtencionesPdf(report) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
  const [defensoria, aurora] = await Promise.all([
    imageUrlToDataUrl(LOGO_DEFENSORIA_URL).catch(() => ''),
    imageUrlToDataUrl(LOGO_AURORA_URL).catch(() => ''),
  ]);
  pdf.setProperties({
    title: 'Informe de gestión de atención jurídica a personas privadas de la libertad',
    subject: `Reporte de ${report.metadata.defensor}`,
    author: 'Defensoría del Pueblo - AURORA',
  });
  buildDocument(pdf, report, { defensoria, aurora });
  const fileName = [
    'reporte_atenciones',
    sanitizeReportFilePart(report.metadata.defensor),
    report.metadata.fechaInicio.replaceAll('-', ''),
    report.metadata.fechaFin.replaceAll('-', ''),
  ].join('_');
  pdf.save(`${fileName}.pdf`);
}
