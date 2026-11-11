import { trainRouterModel, WEIGHTS_PATH } from '../server/ml/routerModel.js';
import { routerService } from '../server/services/routerService.js';

console.log('==============================================================');
console.log(' ENTRENAMIENTO DEL ENRUTADOR DE IA POR BENCHMARKS (IA CHOOSE)');
console.log('==============================================================\n');

const artifact = trainRouterModel({ epochs: 180, learningRate: 0.35 });

console.log(`Muestras de entrenamiento : ${artifact.samplesCount}`);
console.log(`Vocabulario extraído      : ${artifact.vocab.length} n-gramas`);
console.log(`Pesos guardados en        : ${WEIGHTS_PATH}\n`);

console.log('Progreso del entrenamiento por épocas:');
for (const h of artifact.history) {
  console.log(
    `  Época ${String(h.epoch).padStart(3, ' ')} | Loss: ${h.loss.toFixed(4)} | Precisión Dominio: ${h.domainAccuracy}% | Error Complejidad (MAE): ${h.complexityMAE}`
  );
}

console.log('\n==============================================================');
console.log(' PRUEBA EN VIVO DE ENRUTAMIENTO BASADO EN BENCHMARKS');
console.log('==============================================================\n');

const testPrompts = [
  'Haz un hola mundo en python y declara una variable simple',
  'Refactorizar microservicio en Python con concurrencia y pruebas unitarias',
  'Cuánto es 15 por 8 más 20',
  'Demostrar paso a paso la convergencia de una serie de Fourier y resolver ecuación diferencial',
  'Analizar un PDF de tesis de 45 páginas y extraer el marco teórico',
];

for (const prompt of testPrompts) {
  const rec = routerService.recommend(prompt);
  console.log(`Prompt      : "${prompt}"`);
  console.log(
    `Predicción  : Dominio=${rec.analysis.domain} (${rec.analysis.domainConfidence}%) | Complejidad=${Math.round(rec.analysis.complexity * 100)}% (${rec.analysis.complexityLevel})`
  );
  console.log(
    `Benchmark   : ${rec.analysis.benchmarkName} (Umbral exigido >= ${rec.analysis.requiredScore}% | Elegido: ${rec.analysis.benchmarkScore}%)`
  );
  console.log(`IA Elegida  : ${rec.model} -> Costo: ${rec.cost}`);
  console.log(`Justificación: ${rec.reason}\n`);
}
