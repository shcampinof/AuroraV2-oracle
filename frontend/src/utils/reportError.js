export function reportError(error, context = 'app') {
  if (typeof import.meta !== 'undefined' && import.meta?.env?.DEV) {
    console.error(`[${context}]`, error);
  }
}
