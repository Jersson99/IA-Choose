import { config } from '../config.js';
import { HttpError } from '../errors.js';

export function generateFallbackResponse(prompt, model, domain) {
  const clean = String(prompt || '').toLowerCase();

  if (
    domain === 'coding' ||
    clean.includes('python') ||
    clean.includes('codigo') ||
    clean.includes('react') ||
    clean.includes('javascript') ||
    clean.includes('funcion') ||
    clean.includes('variable')
  ) {
    if (clean.includes('hola mundo') || clean.includes('variable')) {
      return `¡Hola! Aquí tienes la solución solicitada procesada con **${model.name}**:\n\n\`\`\`python\n# Declaración de variables y mensaje de bienvenida\nmi_nombre = "Usuario IA CHOOSE"\nprint(f"¡Hola, mundo! Bienvenido/a, {mi_nombre}.")\n\`\`\`\n\n**Explicación técnica:**\n- \`mi_nombre\` almacena una cadena de texto en memoria.\n- Se utiliza un *f-string* (disponible desde Python 3.6+) para interpolar variables con máxima legibilidad y eficiencia.`;
    }
    return `### Solución generada por **${model.name}**\n\nHe analizado tu requerimiento de desarrollo y arquitectura. A continuación la propuesta recomendada:\n\n\`\`\`python\nimport asyncio\nfrom typing import Dict, Any\n\nasync def process_task(payload: Dict[str, Any]) -> Dict[str, Any]:\n    # Procesamiento concurrente optimizado\n    await asyncio.sleep(0.05)\n    return {"status": "ok", "result": payload}\n\`\`\`\n\n**Aspectos clave:**\n1. Manejo asíncrono para alta concurrencia y baja latencia.\n2. Tipado estricto con \`typing\` para trazabilidad y pruebas unitarias.\n3. Arquitectura desacoplada lista para integración en microservicios.`;
  }

  if (
    domain === 'math_reasoning' ||
    clean.includes('ecuacion') ||
    clean.includes('fourier') ||
    clean.includes('calcular') ||
    clean.includes('integral') ||
    clean.includes('despejar')
  ) {
    if (clean.includes('2x + 6 = 14') || clean.includes('despejar') || clean.includes('lineal')) {
      return `### Resolución paso a paso con **${model.name}**\n\nDada la ecuación lineal:\n\\[ 2x + 6 = 14 \\]\n\n**Paso 1:** Restamos 6 a ambos miembros de la igualdad:\n\\[ 2x = 14 - 6 \\]\n\\[ 2x = 8 \\]\n\n**Paso 2:** Dividimos ambos miembros entre 2:\n\\[ x = \\frac{8}{2} = 4 \\]\n\n**Comprobación:**\n\\[ 2(4) + 6 = 8 + 6 = 14 \\quad \\checkmark \\]\n\n**Resultado:** \\( x = 4 \\)`;
    }
    return `### Demostración y análisis matemático con **${model.name}**\n\nPara resolver el problema planteado:\n\n1. **Condiciones de frontera:** Se verifican las condiciones de Dirichlet para asegurar la convergencia puntual y en media cuadrática.\n2. **Coeficientes ortogonales:**\n\\[ a_n = \\frac{1}{\\pi} \\int_{-\\pi}^{\\pi} f(x) \\cos(nx) \\, dx, \\quad b_n = \\frac{1}{\\pi} \\int_{-\\pi}^{\\pi} f(x) \\sin(nx) \\, dx \\]\n3. **Conclusión formal:** La serie converge uniformemente en los intervalos de continuidad con error asintótico \\( \\mathcal{O}(1/n) \\).`;
  }

  if (
    domain === 'long_context' ||
    clean.includes('pdf') ||
    clean.includes('tesis') ||
    clean.includes('documento') ||
    clean.includes('paginas')
  ) {
    return `### Síntesis documental generada por **${model.name}**\n\nTras el análisis contextual extenso del documento:\n\n1. **Objetivo Principal:** Articular los fundamentos teóricos con la evidencia empírica observada.\n2. **Hallazgos Metodológicos:** Se identifica consistencia en la muestra, con especial atención a las variables de control y validez interna.\n3. **Conclusiones Clave:** Las discrepancias reportadas corresponden a diferencias en el marco muestral y no a fallos estructurales.`;
  }

  if (
    domain === 'creative_writing' ||
    clean.includes('cumpleaños') ||
    clean.includes('ensayo') ||
    clean.includes('redactar') ||
    clean.includes('frase')
  ) {
    if (clean.includes('cumpleaños') || clean.includes('amigo')) {
      return `¡Feliz cumpleaños, amigo! Que este nuevo año de vida venga cargado de metas cumplidas, momentos memorables y la alegría que siempre contagias a quienes te rodean. ¡Un abrazo enorme y a celebrar como te lo mereces! 🎂🎉`;
    }
    return `### Propuesta editorial de **${model.name}**\n\nEn un entorno donde la velocidad suele opacar la profundidad, construir narrativas sólidas exige precisión conceptual y ritmo cadencioso. Esta propuesta articula una perspectiva transformadora, entrelazando rigor argumentativo con un estilo literario fluido que cautiva a la audiencia desde la primera línea.`;
  }

  return `### Respuesta generada por **${model.name}**\n\nHe procesado tu consulta de manera estructurada:\n\n- **Respuesta directa:** Tu solicitud ("*${String(prompt).slice(0, 75)}*") ha sido resuelta considerando las directrices técnicas y el contexto provisto.\n- **Detalle relevante:** Se garantiza coherencia, precisión conceptual y alineación con los estándares actuales.\n\n¿Deseas profundizar en algún punto específico o añadir nuevos parámetros a la consulta?`;
}

export const llmProviderService = {
  /**
   * Invoca la API oficial de Moonshot AI (Kimi) si MOONSHOT_API_KEY está configurada en .env.
   * Si no está configurada o el modelo es de otro proveedor aún en piloto, usa el motor simulado.
   */
  async generateCompletion({ modelRow, messages, promptText, domain, complexity = 0.35 }) {
    const startMs = Date.now();
    const isKimiModel =
      modelRow.slug === 'kimi-k2' ||
      modelRow.name.toLowerCase().includes('kimi') ||
      modelRow.provider.toLowerCase().includes('moonshot');

    // Si es Moonshot Kimi y el administrador ya configuró MOONSHOT_API_KEY en el servidor
    if (isKimiModel && config.providers.moonshot.isConfigured) {
      const normalizedMessages =
        Array.isArray(messages) && messages.length > 0
          ? messages
          : [
              {
                role: 'system',
                content:
                  'Eres Kimi, el modelo de inteligencia artificial de Moonshot AI integrado en la plataforma colombiana IA CHOOSE. Responde siempre en español claro, riguroso y bien estructurado.',
              },
              { role: 'user', content: promptText },
            ];

      const candidateModelIds = [
        config.providers.moonshot.modelId,
        'kimi-k2-0711-preview',
        'moonshot-v1-8k',
      ];
      const uniqueModels = [...new Set(candidateModelIds.filter(Boolean))];

      let lastErr = null;
      for (const remoteModelId of uniqueModels) {
        try {
          const response = await fetch(`${config.providers.moonshot.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.providers.moonshot.apiKey}`,
            },
            body: JSON.stringify({
              model: remoteModelId,
              messages: normalizedMessages,
              temperature: 0.6,
            }),
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const msg = errBody?.error?.message || `HTTP ${response.status}`;
            // Si el modelo específico no existe en la cuenta, probar el siguiente fallback (ej. moonshot-v1-8k)
            if (response.status === 404 || response.status === 400) {
              lastErr = new Error(msg);
              continue;
            }
            throw new HttpError(502, `Error desde Moonshot AI (Kimi): ${msg}`);
          }

          const data = await response.json();
          const replyText =
            data?.choices?.[0]?.message?.content ||
            'Respuesta recibida desde Moonshot Kimi sin contenido de texto.';
          const inputTokens =
            Number(data?.usage?.prompt_tokens) ||
            Math.max(48, Math.round(promptText.split(/\s+/).length * 16));
          const outputTokens =
            Number(data?.usage?.completion_tokens) ||
            Math.max(64, Math.round(replyText.split(/\s+/).length * 1.4));
          const latencyMs = Math.max(120, Date.now() - startMs);

          return {
            reply: replyText,
            inputTokens,
            outputTokens,
            latencyMs,
            liveProvider: true,
            remoteModelId,
          };
        } catch (err) {
          if (err instanceof HttpError) throw err;
          lastErr = err;
        }
      }

      if (lastErr) {
        throw new HttpError(
          502,
          `No se pudo completar la consulta en Moonshot AI: ${lastErr.message}`
        );
      }
    }

    // Modo Piloto / Simulación realista cuando aún no se ha puesto la llave maestra en .env
    const words = String(promptText || '').trim().split(/\s+/).length;
    const inputTokens = Math.max(48, Math.round(words * 18 + complexity * 620));
    const outputTokens = Math.max(120, Math.round(180 + complexity * 940));
    const latencyMs = Math.round(modelRow.latency_sec * 1000 + (Math.random() * 180 - 90));
    const reply = generateFallbackResponse(promptText, modelRow, domain);

    return {
      reply,
      inputTokens,
      outputTokens,
      latencyMs,
      liveProvider: false,
      remoteModelId: modelRow.slug,
    };
  },
};
