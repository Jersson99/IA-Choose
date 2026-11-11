import { db } from '../db.js';
import { predictTaskProfile } from '../ml/routerModel.js';

const DOMAIN_META = {
  coding: {
    column: 'swe_bench',
    benchmarkLabel: 'SWE-bench Verified',
    domainLabel: 'Ingeniería de Software y Código',
  },
  math_reasoning: {
    column: 'math_500',
    benchmarkLabel: 'MATH-500 / Razonamiento Formal',
    domainLabel: 'Matemáticas y Lógica',
  },
  long_context: {
    column: 'long_bench',
    benchmarkLabel: 'LongBench (Contexto Extenso)',
    domainLabel: 'Lectura Académica y Documentos',
  },
  general_qa: {
    column: 'mmlu_pro',
    benchmarkLabel: 'MMLU-Pro Multidisciplinar',
    domainLabel: 'Consulta General y Formato',
  },
};

export const routerService = {
  recommend(promptText) {
    const profile = predictTaskProfile(promptText);
    const meta = DOMAIN_META[profile.domain] || DOMAIN_META.general_qa;
    const allModels = db.prepare('SELECT * FROM ai_models_benchmarks ORDER BY cost_cop ASC').all();

    // Umbral mínimo de benchmark exigido según la complejidad detectada por el modelo entrenado:
    // - Tarea básica (complejidad <= 0.35): exige >= 80 pts -> gana el modelo más económico (evita usar Fable 5.1 o Claude)
    // - Tarea media/alta (0.36 - 0.90): exige el líder especialista del benchmark sin pagar tier 'ultra' ($115 COP)
    // - Tarea extrema (> 0.90): desbloquea modelos 'ultra' como Fable 5.1 Frontier
    let requiredScore;
    if (profile.complexity <= 0.35) {
      requiredScore = 80.0;
    } else if (profile.complexity <= 0.65) {
      requiredScore = 87.5;
    } else if (profile.complexity <= 0.90) {
      requiredScore = 92.5;
    } else {
      requiredScore = 96.6;
    }

    // Filtrar candidatos que cumplan el benchmark requerido (y bloquear tier 'ultra' si la complejidad no es extrema)
    let candidates = allModels.filter((m) => {
      if (m.tier === 'ultra' && profile.complexity <= 0.90) return false;
      return m[meta.column] >= requiredScore;
    });

    // Si ningún modelo sin tier 'ultra' alcanza el umbral en ese dominio, elegir el de mayor puntaje disponible (sin 'ultra' salvo complejidad > 0.90)
    if (candidates.length === 0) {
      const pool = allModels.filter((m) => (profile.complexity <= 0.90 ? m.tier !== 'ultra' : true));
      pool.sort((a, b) => b[meta.column] - a[meta.column]);
      candidates = [pool[0]];
    }

    // Para tareas básicas, priorizar el costo mínimo que cumpla el umbral;
    // para tareas complejas, priorizar el mejor puntaje en el benchmark del dominio
    if (profile.complexity <= 0.35) {
      candidates.sort((a, b) => a.cost_cop - b.cost_cop);
    } else {
      candidates.sort((a, b) => b[meta.column] - a[meta.column] || a.cost_cop - b.cost_cop);
    }

    const chosen = candidates[0];
    const frontierModel = allModels.find((m) => m.tier === 'ultra') || allModels[allModels.length - 1];
    const savingPct = Math.max(
      0,
      Math.round(((frontierModel.cost_cop - chosen.cost_cop) / frontierModel.cost_cop) * 100)
    );

    const complexityLevel =
      profile.complexity <= 0.35
        ? 'Básica'
        : profile.complexity <= 0.75
        ? 'Intermedia'
        : 'Avanzada';

    const reason =
      profile.complexity <= 0.35
        ? `Tarea ${complexityLevel} (${Math.round(profile.complexity * 100)}%) en ${meta.domainLabel}. ${chosen.name} alcanza ${chosen[meta.column]}% en ${meta.benchmarkLabel} y evita gastar $${frontierModel.cost_cop} COP en ${frontierModel.name} (ahorro del ${savingPct}%).`
        : `Tarea ${complexityLevel} (${Math.round(profile.complexity * 100)}%) en ${meta.domainLabel}. ${chosen.name} lidera en ${meta.benchmarkLabel} (${chosen[meta.column]}%) con tarifa óptima de $${chosen.cost_cop} COP.`;

    return {
      model: chosen.name,
      provider: chosen.provider,
      cost: `$${chosen.cost_cop} COP`,
      reason,
      analysis: {
        domain: profile.domain,
        domainLabel: meta.domainLabel,
        domainConfidence: profile.domainConfidence,
        complexity: profile.complexity,
        complexityLevel,
        benchmarkName: meta.benchmarkLabel,
        benchmarkScore: chosen[meta.column],
        requiredScore,
        savingPct,
      },
    };
  },

  listBenchmarks() {
    return db.prepare('SELECT * FROM ai_models_benchmarks ORDER BY cost_cop ASC').all();
  },
};
