import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { costEngineService, estimateTokensFromText } from './costEngineService.js';

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
   * Invoca la API oficial de Google AI (Gemini) cuando GEMINI_API_KEY está configurada en .env,
   * o Moonshot AI (Kimi) si MOONSHOT_API_KEY está configurada.
   * Devuelve el objeto normalizado de uso (incluyendo cachedTokens, cacheWriteTokens y reasoningTokens).
   */
  async generateCompletion({
    modelRow,
    messages,
    promptText,
    domain,
    complexity = 0.35,
    maxOutputTokens = 2048,
    contextInfo = null,
  }) {
    const startMs = Date.now();
    const isGeminiModel =
      modelRow.slug === 'gemini-flash' ||
      modelRow.name.toLowerCase().includes('gemini') ||
      modelRow.provider.toLowerCase().includes('google');

    const isKimiModel =
      modelRow.slug === 'kimi-k2' ||
      modelRow.name.toLowerCase().includes('kimi') ||
      modelRow.provider.toLowerCase().includes('moonshot');

    const isDeepSeekModel =
      modelRow.slug.startsWith('deepseek') ||
      modelRow.name.toLowerCase().includes('deepseek') ||
      modelRow.provider.toLowerCase().includes('deepseek');

    // 0. Si el usuario seleccionó DeepSeek, exigimos conexión real con DeepSeek API (sin fallback falso)
    if (isDeepSeekModel) {
      if (!config.providers.deepseek.isConfigured) {
        throw new HttpError(
          400,
          `Para consultar ${modelRow.name} en tiempo real, agrega tu clave DEEPSEEK_API_KEY=... en el archivo .env en la raíz de IA-Choose (puedes generarla en https://platform.deepseek.com/api_keys).`
        );
      }

      const modelRate = costEngineService.getPricingForModel(modelRow.slug, modelRow);
      const remoteModelId = modelRate?.remote_model_id || config.providers.deepseek.modelId || 'deepseek-reasoner';
      const normalizedMessages =
        Array.isArray(messages) && messages.length > 0
          ? messages
          : [
              {
                role: 'system',
                content: `Eres ${modelRow.name}, modelo de DeepSeek integrado en la plataforma colombiana IA CHOOSE. Responde siempre en español claro, preciso y bien estructurado.`,
              },
              { role: 'user', content: promptText },
            ];

      const isFlashModel = remoteModelId === 'deepseek-flash';

      const response = await fetch(`${config.providers.deepseek.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.providers.deepseek.apiKey}`,
        },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          model: remoteModelId,
          messages: normalizedMessages,
          // En DeepSeek V4.1 Flash desactivamos el pensamiento interno para máxima velocidad (3-8s) y ahorro;
          // en DeepSeek V4 Pro y DeepSeek R1 mantenemos el razonamiento activo con effort:"low".
          ...(isFlashModel ? { thinking: { type: 'disabled' } } : { effort: 'low' }),
          max_tokens: Math.max(8192, Number(maxOutputTokens) || 8192),
          ...(remoteModelId === 'deepseek-reasoner' ? {} : { temperature: 0.6 }),
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody?.error?.message || `HTTP ${response.status}`;
        throw new HttpError(
          response.status === 402 ? 402 : 502,
          `Error desde DeepSeek API (${remoteModelId}): ${msg}`
        );
      }

      const data = await response.json();
      const msgObj = data?.choices?.[0]?.message || {};
      const replyText =
        msgObj.content?.trim() ||
        msgObj.reasoning_content?.trim() ||
        'Respuesta recibida desde DeepSeek API sin contenido de texto.';

      const hasUsageBlock = Boolean(data?.usage?.prompt_tokens);
      const inputTokens =
        Number(data?.usage?.prompt_tokens) ||
        contextInfo?.estimatedInputTokens ||
        estimateTokensFromText(promptText) + 32;
      const cachedTokens =
        Number(data?.usage?.prompt_cache_hit_tokens) ||
        Number(data?.usage?.prompt_tokens_details?.cached_tokens) ||
        0;
      const outputTokens =
        Number(data?.usage?.completion_tokens) ||
        estimateTokensFromText(replyText);
      const reasoningTokens =
        Number(data?.usage?.completion_tokens_details?.reasoning_tokens) || 0;
      const latencyMs = Math.max(120, Date.now() - startMs);

      return {
        reply: replyText,
        inputTokens,
        cachedTokens,
        cacheWriteTokens: 0,
        outputTokens,
        reasoningTokens,
        isEstimatedUsage: !hasUsageBlock,
        latencyMs,
        liveProvider: true,
        remoteModelId: data?.model || remoteModelId,
      };
    }

    // 1. Si es Moonshot Kimi y MOONSHOT_API_KEY está configurada en el servidor, priorizamos la API oficial de Moonshot
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
        'kimi-k2.6',
        'kimi-k2.7-code',
        'kimi-k2-0905-preview',
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
            signal: AbortSignal.timeout(25000),
            body: JSON.stringify({
              model: remoteModelId,
              messages: normalizedMessages,
              max_tokens: maxOutputTokens,
              temperature: 0.6,
            }),
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const msg = errBody?.error?.message || `HTTP ${response.status}`;
            // Solo probamos el siguiente ID candidato si el modelo específico devuelve 404 (no encontrado)
            if (response.status === 404) {
              lastErr = new Error(msg);
              continue;
            }
            throw new HttpError(502, `Error desde Moonshot AI (Kimi): ${msg}`);
          }

          const data = await response.json();
          const replyText =
            data?.choices?.[0]?.message?.content ||
            'Respuesta recibida desde Moonshot Kimi sin contenido de texto.';

          const hasUsageBlock = Boolean(data?.usage?.prompt_tokens);
          const inputTokens =
            Number(data?.usage?.prompt_tokens) ||
            contextInfo?.estimatedInputTokens ||
            estimateTokensFromText(promptText) + 32;
          const cachedTokens =
            Number(data?.usage?.prompt_tokens_details?.cached_tokens) ||
            Number(data?.usage?.cached_tokens) ||
            0;
          const cacheWriteTokens =
            Number(data?.usage?.prompt_tokens_details?.cache_write_tokens) || 0;
          const outputTokens =
            Number(data?.usage?.completion_tokens) ||
            estimateTokensFromText(replyText);
          const reasoningTokens =
            Number(data?.usage?.completion_tokens_details?.reasoning_tokens) || 0;
          const latencyMs = Math.max(120, Date.now() - startMs);

          return {
            reply: replyText,
            inputTokens,
            cachedTokens,
            cacheWriteTokens,
            outputTokens,
            reasoningTokens,
            isEstimatedUsage: !hasUsageBlock,
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

    // Si el usuario seleccionó cualquier modelo de Google AI Pro, exigimos conexión real (sin simulación falsa)
    if (isGeminiModel && !config.providers.google.isConfigured) {
      throw new HttpError(
        400,
        `Para consultar ${modelRow.name} en tiempo real, agrega tu clave GEMINI_API_KEY=... en el archivo .env en la raíz de IA-Choose (puedes generarla en https://aistudio.google.com/app/apikey).`
      );
    }

    // 2. Conexión en vivo con Google AI (v1beta/models/<remote_model_id>:generateContent) cuando GEMINI_API_KEY está en .env
    if (
      config.providers.google.isConfigured &&
      (isGeminiModel || !config.providers.moonshot.isConfigured || !isKimiModel)
    ) {
      const modelRate = costEngineService.getPricingForModel(modelRow.slug, modelRow);
      const primaryRemoteModelId =
        isGeminiModel && modelRate?.remote_model_id
          ? modelRate.remote_model_id
          : config.providers.google.modelId;

      const geminiCandidates = isGeminiModel
        ? [primaryRemoteModelId, primaryRemoteModelId] // Reintento sobre el mismo modelo exacto si hay pico 503
        : [
            primaryRemoteModelId,
            'gemini-4-hydrogen',
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
          ];

      const systemMsg =
        (Array.isArray(messages) && messages.find((m) => m?.role === 'system')?.content) ||
        `Eres ${modelRow.name}, modelo integrado en la plataforma colombiana IA CHOOSE. Responde siempre en español claro, preciso y bien estructurado.`;

      const contents =
        Array.isArray(messages) && messages.length > 0
          ? messages
              .filter((m) => m?.role !== 'system' && m?.content)
              .map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: String(m.content) }],
              }))
          : [{ role: 'user', parts: [{ text: String(promptText) }] }];

      let lastGeminiErr = null;
      const effectiveMaxOutputTokens = Math.max(8192, Number(maxOutputTokens) || 8192);

      for (let attempt = 0; attempt < geminiCandidates.length; attempt += 1) {
        const remoteModelId = geminiCandidates[attempt];
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            remoteModelId
          )}:generateContent?key=${encodeURIComponent(config.providers.google.apiKey)}`;

          const generationConfig = {
            temperature: 0.6,
            maxOutputTokens: effectiveMaxOutputTokens,
          };

          // Los modelos gemma-* no admiten thinkingBudget en generationConfig;
          // en los modelos gemini-* limitamos thinkingBudget a 1024 para proteger tokens visibles y margen
          if (!remoteModelId.startsWith('gemma-')) {
            generationConfig.thinkingConfig = {
              thinkingBudget: 1024,
            };
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(60000),
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemMsg }],
              },
              contents:
                contents.length > 0
                  ? contents
                  : [{ role: 'user', parts: [{ text: String(promptText) }] }],
              generationConfig,
            }),
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const msg = errBody?.error?.message || `HTTP ${response.status}`;

            if (response.status === 429 && isGeminiModel) {
              throw new HttpError(
                429,
                `Google AI Studio reportó límite de cuota (HTTP 429 Free Tier) para ${modelRow.name} (${remoteModelId}). Para habilitar cuota de API en este modelo dentro de AI Studio, vincula "Set up Billing" (Tier 1) en https://aistudio.google.com/app/api-keys. Tu saldo en IA Choose no fue descontado ($0 COP).`
              );
            }

            if (response.status === 503 && attempt < geminiCandidates.length - 1) {
              await new Promise((r) => setTimeout(r, 900));
              lastGeminiErr = new Error(msg);
              continue;
            }

            if ((response.status === 404 || response.status === 503 || response.status === 429) && !isGeminiModel) {
              lastGeminiErr = new Error(msg);
              continue;
            }

            throw new HttpError(502, `Error desde Google AI (${modelRow.name}): ${msg}`);
          }

          const data = await response.json();
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const replyText =
            parts
              .filter((p) => !p?.thought)
              .map((p) => p?.text || '')
              .join('')
              .trim() ||
            'Respuesta recibida desde Google AI (Gemini) sin contenido de texto.';

          const hasUsageMeta = Boolean(data?.usageMetadata?.promptTokenCount);
          const inputTokens =
            Number(data?.usageMetadata?.promptTokenCount) ||
            contextInfo?.estimatedInputTokens ||
            estimateTokensFromText(promptText) + 24;
          const cachedTokens = Number(data?.usageMetadata?.cachedContentTokenCount) || 0;
          const visibleOutputTokens =
            Number(data?.usageMetadata?.candidatesTokenCount) ||
            estimateTokensFromText(replyText);
          const reasoningTokens = Number(data?.usageMetadata?.thoughtsTokenCount) || 0;
          // En Google usageMetadata, thoughtsTokenCount viene separado de candidatesTokenCount;
          // los sumamos en outputTokens para que CostEngineService los liquide sin omitir el razonamiento
          const outputTokens = visibleOutputTokens + reasoningTokens;
          const latencyMs = Math.max(100, Date.now() - startMs);

          return {
            reply: replyText,
            inputTokens,
            cachedTokens,
            cacheWriteTokens: 0,
            outputTokens,
            reasoningTokens,
            isEstimatedUsage: !hasUsageMeta,
            latencyMs,
            liveProvider: true,
            remoteModelId: data?.modelVersion || remoteModelId,
          };
        } catch (err) {
          if (err instanceof HttpError) throw err;
          lastGeminiErr = err;
        }
      }

      if (lastGeminiErr) {
        throw new HttpError(
          502,
          `No se pudo completar la consulta en Google AI (Gemini): ${lastGeminiErr.message}`
        );
      }
    }

    // 3. Modo Piloto / Simulación realista con cálculo fiel del historial y Context Caching
    const reply = generateFallbackResponse(promptText, modelRow, domain);
    const baseTurnInput = contextInfo?.estimatedInputTokens
      ? contextInfo.estimatedInputTokens
      : Math.max(48, estimateTokensFromText(promptText) + Math.round(complexity * 240));

    // Si hay turnos previos en la conversación, simulamos el 85% de Cache Hit sobre el prefijo repetido
    const cachedTokens =
      contextInfo && contextInfo.turnCount > 1 && contextInfo.prefixHistoryTokens > 64
        ? Math.round(contextInfo.prefixHistoryTokens * 0.85)
        : 0;

    const outputTokens = Math.max(
      96,
      estimateTokensFromText(reply) + Math.round(complexity * 320)
    );
    const reasoningTokens =
      modelRow.slug === 'deepseek-r1' ? Math.round(outputTokens * 0.35) : 0;
    const latencyMs = Math.round(modelRow.latency_sec * 1000 + (Math.random() * 180 - 90));

    return {
      reply,
      inputTokens: baseTurnInput,
      cachedTokens,
      cacheWriteTokens: 0,
      outputTokens,
      reasoningTokens,
      isEstimatedUsage: false,
      latencyMs,
      liveProvider: false,
      remoteModelId: isKimiModel ? 'kimi-k2.6' : modelRow.slug,
    };
  },
};
