export const LABEL_ACTUALIZAR_CASO = 'Actualizar caso';
export const LABEL_INICIAR_ACTUACION = 'Iniciar actuaci\u00f3n';

export function getLabelAccionCaso(sinActuaciones) {
  return sinActuaciones ? LABEL_INICIAR_ACTUACION : LABEL_ACTUALIZAR_CASO;
}
