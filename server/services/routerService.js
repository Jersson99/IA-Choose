import { db } from '../db.js';
import { predictTaskProfile } from '../ml/routerModel.js';

export const DOMAIN_META = {
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
  creative_writing: {
    column: 'arena_writing',
    benchmarkLabel: 'Arena-Hard (Redacción y Síntesis)',
    domainLabel: 'Redacción y Ensayo Editorial',
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

    // Umbral mínimo de benchmark exigido y política por nivel de complejidad:
    // 1. Básica (<= 0.35): umbral 80.0% -> gana el más económico que cumpla (Gemini Flash $9 COP)
    // 2. Intermedia (0.36 - 0.68): umbral 86.0% -> especialistas costo-eficientes (bloquea tiers caros frontier/ultra)
    // 3. Avanzada (0.69 - 0.90): umbral 91.5% -> líder del benchmark del dominio (bloquea tier ultra de $115 COP)
    // 4. Frontera (> 0.90): umbral 96.6% -> desbloquea tier ultra (Fable 5.1 Frontier)
    let requiredScore;
    let complexityLevel;

    if (profile.complexity <= 0.35) {
      requiredScore = 80.0;
      complexityLevel = 'Básica';
    } else if (profile.complexity <= 0.68) {
      requiredScore = 86.0;
      complexityLevel = 'Intermedia';
    } else if (profile.complexity <= 0.90) {
      requiredScore = 91.5;
      complexityLevel = 'Avanzada';
    } else {
      requiredScore = 96.6;
      complexityLevel = 'Frontera';
    }

    let candidates = allModels.filter((m) => {
      if (profile.complexity <= 0.35 && (m.tier === 'frontier' || m.tier === 'ultra')) return false;
      if (profile.complexity <= 0.68 && (m.tier === 'frontier' || m.tier === 'ultra')) return false;
      if (profile.complexity <= 0.90 && m.tier === 'ultra') return false;
      return m[meta.column] >= requiredScore;
    });

    if (candidates.length === 0) {
      const pool = allModels.filter((m) => (profile.complexity <= 0.90 ? m.tier !== 'ultra' : true));
      pool.sort((a, b) => b[meta.column] - a[meta.column]);
      candidates = [pool[0]];
    }

    if (profile.complexity <= 0.35) {
      // En tareas básicas: menor tarifa primero
      candidates.sort((a, b) => a.cost_cop - b.cost_cop);
    } else if (profile.complexity <= 0.68) {
      // En tareas intermedias: mejor relación (puntaje benchmark / costo)
      candidates.sort(
        (a, b) => b[meta.column] - a[meta.column] * 0.98 || a.cost_cop - b.cost_cop
      );
    } else {
      // En tareas avanzadas/frontera: máximo desempeño en el benchmark del dominio
      candidates.sort((a, b) => b[meta.column] - a[meta.column] || a.cost_cop - b.cost_cop);
    }

    const chosen = candidates[0];
    const frontierModel =
      allModels.find((m) => m.tier === 'ultra') || allModels[allModels.length - 1];
    const savingPct = Math.max(
      0,
      Math.round(((frontierModel.cost_cop - chosen.cost_cop) / frontierModel.cost_cop) * 100)
    );

    const reason =
      profile.complexity <= 0.68
        ? `Tarea ${complexityLevel} (${Math.round(profile.complexity * 100)}%) en ${meta.domainLabel}. ${chosen.name} alcanza ${chosen[meta.column]}% en ${meta.benchmarkLabel} por $${chosen.cost_cop} COP y evita gastar $${frontierModel.cost_cop} COP en ${frontierModel.name} (${savingPct}% de ahorro).`
        : `Tarea ${complexityLevel} (${Math.round(profile.complexity * 100)}%) en ${meta.domainLabel}. ${chosen.name} lidera con ${chosen[meta.column]}% en ${meta.benchmarkLabel} a una tarifa de $${chosen.cost_cop} COP.`;

    return {
      model: chosen.name,
      provider: chosen.provider,
      cost: `$${chosen.cost_cop} COP`,
      costCopNumeric: chosen.cost_cop,
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
