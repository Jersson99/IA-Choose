import { trainRouterModel, WEIGHTS_PATH, DOMAINS as TASK_DOMAINS } from '../server/ml/routerModel.js';
import {
  ALL_LABELED_SAMPLES,
  TRAINING_SAMPLES,
  VALIDATION_SAMPLES,
} from '../server/ml/trainingDataset.js';
import { routerService } from '../server/services/routerService.js';

console.log('==============================================================================');
console.log(' ENTRENAMIENTO Y EVALUACIÓN DEL ENRUTADOR DE IA POR BENCHMARKS (IA CHOOSE)');
console.log('==============================================================================\n');

const artifact = trainRouterModel({ epochs: 220, learningRate: 0.42 });

const trapCount = ALL_LABELED_SAMPLES.filter((s) => s.isTrap).length;

console.log(`Total muestras etiquetadas : ${ALL_LABELED_SAMPLES.length} (${trapCount} casos trampa incluidos)`);
console.log(`Split Train (80%)          : ${TRAINING_SAMPLES.length} muestras`);
console.log(`Split Validación (20%)     : ${VALIDATION_SAMPLES.length} muestras (no vistas en entrenamiento)`);
console.log(`Vocabulario extraído       : ${artifact.vocab.length} features (unigramas, bigramas y raíces morfológicas)`);
console.log(`Pesos guardados en         : ${WEIGHTS_PATH}\n`);

console.log('------------------------------------------------------------------------------');
console.log(' 1. PROGRESO DEL ENTRENAMIENTO POR ÉPOCAS (TRAIN VS VALIDACIÓN)');
console.log('------------------------------------------------------------------------------');
for (const h of artifact.history) {
  console.log(
    `  Época ${String(h.epoch).padStart(3, ' ')} | Loss: ${h.loss.toFixed(4)} | Train Acc: ${String(
      h.trainAccuracy.toFixed(1)
    ).padStart(5, ' ')}% | Val Acc: ${String(h.valAccuracy.toFixed(1)).padStart(
      5,
      ' '
    )}% | Val F1: ${String(h.valMacroF1.toFixed(1)).padStart(5, ' ')}% | Val MAE: ${h.valMAE.toFixed(4)}`
  );
}

const val = artifact.validationReport;
const trn = artifact.trainReport;

console.log('\n------------------------------------------------------------------------------');
console.log(' 2. MÉTRICAS POR DOMINIO EN VALIDACIÓN (20% OUT-OF-SAMPLE)');
console.log('------------------------------------------------------------------------------');
console.log(
  `  ${'Dominio'.padEnd(20, ' ')} | ${'Soporte'.padStart(7, ' ')} | ${'Precisión'.padStart(
    9,
    ' '
  )} | ${'Recall'.padStart(8, ' ')} | ${'F1-Score'.padStart(8, ' ')}`
);
console.log('  ' + '-'.repeat(64));
for (const m of val.perDomain) {
  console.log(
    `  ${m.domain.padEnd(20, ' ')} | ${String(m.support).padStart(7, ' ')} | ${(
      m.precision.toFixed(1) + '%'
    ).padStart(9, ' ')} | ${(m.recall.toFixed(1) + '%').padStart(8, ' ')} | ${(
      m.f1.toFixed(1) + '%'
    ).padStart(8, ' ')}`
  );
}
console.log('  ' + '-'.repeat(64));
console.log(
  `  Resumen Global -> Train Acc: ${trn.domainAccuracy}% (MAE ${trn.complexityMAE}) | Val Acc: ${val.domainAccuracy}% | Val Macro-F1: ${val.macroF1}% | Val MAE: ${val.complexityMAE}`
);

console.log('\n------------------------------------------------------------------------------');
console.log(' 3. MATRIZ DE CONFUSIÓN EN VALIDACIÓN (Filas = Real, Columnas = Predicho)');
console.log('------------------------------------------------------------------------------');
const shortLabels = {
  coding: 'coding',
  math_reasoning: 'math_r',
  long_context: 'long_c',
  creative_writing: 'creatv',
  general_qa: 'gen_qa',
};
const headerCols = TASK_DOMAINS.map((d) => shortLabels[d].padStart(7, ' ')).join(' | ');
console.log(`  ${'Real \\ Pred'.padEnd(18, ' ')} | ${headerCols}`);
console.log('  ' + '-'.repeat(18 + 3 + headerCols.length));
TASK_DOMAINS.forEach((actual, rIdx) => {
  const rowStr = TASK_DOMAINS.map((_, cIdx) =>
    String(val.confusionMatrix[rIdx][cIdx]).padStart(7, ' ')
  ).join(' | ');
  console.log(`  ${actual.padEnd(18, ' ')} | ${rowStr}`);
});

console.log('\n------------------------------------------------------------------------------');
console.log(' 4. SIMULACIÓN DE AHORRO FINANCIERO EN COP (SOBRE SET DE VALIDACIÓN)');
console.log('------------------------------------------------------------------------------');

const COST_FABLE_FRONTIER = 115; // Fable 5.1 Frontier ($115 COP)
const COST_CLAUDE_SONNET = 58; // Claude 3.7 Sonnet ($58 COP)

let routerTotalCop = 0;
const modelDistribution = {};

for (const sample of VALIDATION_SAMPLES) {
  const rec = routerService.recommend(sample.text);
  routerTotalCop += rec.costCopNumeric || 0;
  modelDistribution[rec.model] = (modelDistribution[rec.model] || 0) + 1;
}

const baselineFableCop = VALIDATION_SAMPLES.length * COST_FABLE_FRONTIER;
const baselineClaudeCop = VALIDATION_SAMPLES.length * COST_CLAUDE_SONNET;
const savedVsFablePct = Math.round(((baselineFableCop - routerTotalCop) / baselineFableCop) * 1000) / 10;
const savedVsClaudePct = Math.round(((baselineClaudeCop - routerTotalCop) / baselineClaudeCop) * 1000) / 10;

console.log(`  Peticiones evaluadas (Validación)       : ${VALIDATION_SAMPLES.length} consultas`);
console.log(`  Costo usando siempre Fable 5.1 Frontier : $${baselineFableCop.toLocaleString('es-CO')} COP`);
console.log(`  Costo usando siempre Claude 3.7 Sonnet  : $${baselineClaudeCop.toLocaleString('es-CO')} COP`);
console.log(`  Costo inteligente con IA CHOOSE Router  : $${routerTotalCop.toLocaleString('es-CO')} COP`);
console.log(
  `  Ahorro neto vs Fable 5.1 Frontier       : $${(
    baselineFableCop - routerTotalCop
  ).toLocaleString('es-CO')} COP (${savedVsFablePct}% de ahorro)`
);
console.log(
  `  Ahorro neto vs Claude 3.7 Sonnet        : $${(
    baselineClaudeCop - routerTotalCop
  ).toLocaleString('es-CO')} COP (${savedVsClaudePct}% de ahorro)\n`
);

console.log('  Distribución de modelos asignados en validación:');
for (const [modelName, count] of Object.entries(modelDistribution)) {
  const pct = ((count / VALIDATION_SAMPLES.length) * 100).toFixed(1);
  console.log(`    - ${modelName.padEnd(26, ' ')}: ${String(count).padStart(2, ' ')} consultas (${pct}%)`);
}

console.log('\n------------------------------------------------------------------------------');
console.log(' 5. PRUEBA DE CASOS TRAMPA (MISMA PALABRA CLAVE, DISTINTA COMPLEJIDAD)');
console.log('------------------------------------------------------------------------------\n');

const trapPairs = [
  {
    pairName: 'Par 1: Palabra clave "Python"',
    basic: 'Haz un hola mundo en Python y declara una variable con mi nombre',
    advanced:
      'Diseñar la arquitectura completa de un motor de pagos distribuido con saga pattern, idempotencia, particionamiento en Kafka y tolerancia a fallos bizantinos',
  },
  {
    pairName: 'Par 2: Palabra clave "Ecuación"',
    basic: 'Despejar la x en la ecuación lineal sencilla 2x + 6 = 14',
    advanced:
      'Demostrar formalmente la existencia y unicidad de soluciones para una ecuación diferencial parcial estocástica no lineal en espacios de Sobolev',
  },
  {
    pairName: 'Par 3: Palabra clave "Tesis / PDF"',
    basic: 'Cómo se cita una tesis en formato APA séptima edición con un ejemplo breve',
    advanced:
      'Analizar un PDF de tesis doctoral de 120 páginas y sintetizar las contradicciones metodológicas entre el marco teórico y los hallazgos empíricos',
  },
  {
    pairName: 'Par 4: Redacción Creativa (Básica vs Avanzada)',
    basic: 'Escribe una frase corta de cumpleaños para una tarjeta de mi mejor amigo',
    advanced:
      'Escribe un ensayo literario y manifiesto de marca con narrativa cinematográfica, metáforas sensoriales y múltiples arcos dramáticos para una campaña global',
  },
];

for (const pair of trapPairs) {
  console.log(`  === ${pair.pairName} ===`);
  for (const [label, prompt] of [
    ['Tarea Básica  ', pair.basic],
    ['Tarea Compleja', pair.advanced],
  ]) {
    const rec = routerService.recommend(prompt);
    console.log(`  [${label}] "${prompt}"`);
    console.log(
      `     -> Dominio: ${rec.analysis.domain} (${rec.analysis.domainConfidence}%) | Complejidad: ${Math.round(
        rec.analysis.complexity * 100
      )}% (${rec.analysis.complexityLevel}) | Benchmark: ${rec.analysis.benchmarkName} >= ${
        rec.analysis.requiredScore
      }%`
    );
    console.log(`     -> IA Elegida: ${rec.model} (${rec.cost})\n`);
  }
}
