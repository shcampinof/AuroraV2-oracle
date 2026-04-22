export const LABEL_ACTUALIZAR_CASO = 'Actualizar actuaci\u00f3n';
export const LABEL_INICIAR_ACTUACION = 'Actualizar actuaci\u00f3n';

export function getLabelAccionCaso(sinActuaciones) {
  return sinActuaciones ? LABEL_INICIAR_ACTUACION : LABEL_ACTUALIZAR_CASO;
}
