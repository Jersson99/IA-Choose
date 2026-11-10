/**
 * Recomendador rápido de modelo según la tarea escrita en el Dashboard
 */
export function recommendModelForTask(text) {
  const lower = text.toLowerCase();
  if (
    lower.includes('código') ||
    lower.includes('codigo') ||
    lower.includes('python') ||
    lower.includes('javascript') ||
    lower.includes('programar') ||
    lower.includes('bug')
  ) {
    return {
      model: 'Claude 3.7 Sonnet',
      reason: 'Óptimo para arquitectura de software, depuración y razonamiento lógico.',
      cost: '$58 COP'
    };
  }
  if (
    lower.includes('tesis') ||
    lower.includes('pdf') ||
    lower.includes('artículo') ||
    lower.includes('articulo') ||
    lower.includes('ensayo') ||
    lower.includes('lectura')
  ) {
    return {
      model: 'Moonshot Kimi K2',
      reason: 'Ideal para análisis de documentos largos y retención de contexto académico.',
      cost: '$18 COP'
    };
  }
  if (
    lower.includes('matemática') ||
    lower.includes('calculo') ||
    lower.includes('algoritmo') ||
    lower.includes('física')
  ) {
    return {
      model: 'DeepSeek R1',
      reason: 'Especializado en verificación formal y resolución paso a paso.',
      cost: '$14 COP'
    };
  }
  return {
    model: 'Gemini 2.5 Flash',
    reason: 'Respuesta ultrarrápida y tarifa mínima para consultas generales y resúmenes.',
    cost: '$9 COP'
  };
}
