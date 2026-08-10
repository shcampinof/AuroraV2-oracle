export const AURORA_FIELD_IDS = {
  // Bloque 3 - Analisis juridico (AURORA)
  B3_DEFENSOR_ASIGNADO: 'aurora_b3_defensorAsignado',
  B3_FECHA_ANALISIS: 'aurora_b3_fechaAnalisis',
  B3_ANALISIS_ACTUACION: 'aurora_b3_analisisActuacion',
  B3_PROCEDENCIA_LIBERTAD_CONDICIONAL: 'aurora_b3_procedenciaLibertadCondicional',
  B3_PROCEDENCIA_PRISION_DOMICILIARIA: 'aurora_b3_procedenciaPrisionDomiciliaria',
  B3_PROCEDENCIA_UTILIDAD_PUBLICA: 'aurora_b3_procedenciaUtilidadPublica',
  B3_PROCEDENCIA_PENA_CUMPLIDA: 'aurora_b3_procedenciaPenaCumplida',
  B3_PROCEDENCIA_ACUMULACION_PENAS: 'aurora_b3_procedenciaAcumulacionPenas',
  B3_OTRAS_SOLICITUDES: 'aurora_b3_otrasSolicitudes',
  B3_RESUMEN_ANALISIS: 'aurora_b3_resumenAnalisis',
} as const;

export type AuroraFieldId = (typeof AURORA_FIELD_IDS)[keyof typeof AURORA_FIELD_IDS];
