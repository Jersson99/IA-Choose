import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../config.js';
import { TRAINING_SAMPLES } from './trainingDataset.js';

export const WEIGHTS_PATH = path.join(DATA_DIR, 'router_weights.json');

export const DOMAINS = ['coding', 'math_reasoning', 'long_context', 'general_qa'];

const BASIC_HINTS = new Set([
  'hola', 'mundo', 'simple', 'basico', 'basica', 'corto', 'corta', 'breve',
  'declarar', 'variable', 'sumar', 'dos', 'promedio', 'linea', 'tres', 'frase',
  'ejemplo', 'centrar', 'convertir', 'dia', 'correo', 'ortografia'
]);

const ADVANCED_HINTS = new Set([
  'refactorizar', 'microservicio', 'concurrencia', 'unitarias', 'arquitectura',
  'compilador', 'distribuido', 'consenso', 'demostrar', 'convergencia', 'fourier',
  'diferencial', 'impropia', 'residuos', 'cauchy', 'induccion', 'asintotica',
  'autovalores', 'hermitiana', 'cuantica', 'lagrange', 'estocastico', 'markov',
  'tesis', 'paginas', 'metodologica', 'marco', 'teorico', 'doctoral', 'exhaustiva',
  'fuga', 'memoria', 'optimizar', 'particionamiento', 'auditar'
]);

// Normaliza texto quitando tildes y signos para tokenización consistente
export function normalizeText(raw = '') {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTokens(raw = '') {
  const clean = normalizeText(raw);
  if (!clean) return [];
  const words = clean.split(' ').filter((w) => w.length > 1);
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i += 1) {
    bigrams.push(`${words[i]}_${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

// Extrae señales estructurales de complejidad además del vocabulario aprendido
function extractStructuralSignals(raw = '') {
  const clean = normalizeText(raw);
  const words = clean ? clean.split(' ') : [];
  let basicHits = 0;
  let advancedHits = 0;

  for (const w of words) {
    if (BASIC_HINTS.has(w)) basicHits += 1;
    if (ADVANCED_HINTS.has(w)) advancedHits += 1;
  }

  // Detectar si menciona muchas páginas o gran volumen (ej. "45 paginas", "120 paginas")
  const pageMatch = clean.match(/(\d+)\s*(paginas|pags|articulos|hojas|capítulos|capitulos)/);
  const pageVolume = pageMatch ? Math.min(1, Number(pageMatch[1]) / 60) : 0;

  const lengthSignal = Math.min(1, words.length / 22);
  return {
    bias: 1.0,
    lengthSignal,
    basicRatio: basicHits / Math.max(1, words.length),
    advancedRatio: advancedHits / Math.max(1, words.length),
    pageVolume,
  };
}

function softmax(logits) {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - maxLogit));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, z))));
}

/**
 * Entrena el modelo clasificador (Softmax para Dominio + Regresor Sigmoid para Complejidad)
 * usando Descenso de Gradiente sobre el dataset etiquetado y guarda los pesos en JSON.
 */
export function trainRouterModel({ epochs = 180, learningRate = 0.35, l2 = 0.0008 } = {}) {
  const vocabSet = new Set();
  for (const sample of TRAINING_SAMPLES) {
    for (const token of extractTokens(sample.text)) {
      vocabSet.add(token);
    }
  }
  const vocab = Array.from(vocabSet);
  const vocabIndex = new Map(vocab.map((tok, i) => [tok, i]));
  const numFeatures = vocab.length;
  const numClasses = DOMAINS.length;

  // Pesos para clasificación de dominio: matriz [numClasses][numFeatures] + bias[numClasses]
  const classWeights = Array.from({ length: numClasses }, () => new Array(numFeatures).fill(0));
  const classBias = new Array(numClasses).fill(0);

  // Pesos para regresión de complejidad: vector[numFeatures] + pesos estructurales
  const compWeights = new Array(numFeatures).fill(0);
  const structKeys = ['bias', 'lengthSignal', 'basicRatio', 'advancedRatio', 'pageVolume'];
  const structWeights = {
    bias: -0.4,
    lengthSignal: 0.6,
    basicRatio: -1.8,
    advancedRatio: 2.2,
    pageVolume: 1.4,
  };

  // Pre-vectorizar muestras de entrenamiento
  const encodedSamples = TRAINING_SAMPLES.map((s) => {
    const tokens = extractTokens(s.text);
    const activeIndices = [];
    for (const t of tokens) {
      const idx = vocabIndex.get(t);
      if (idx !== undefined) activeIndices.push(idx);
    }
    return {
      ...s,
      classIdx: DOMAINS.indexOf(s.domain),
      activeIndices,
      scale: 1 / Math.sqrt(Math.max(1, activeIndices.length)),
      struct: extractStructuralSignals(s.text),
    };
  });

  const history = [];

  for (let epoch = 1; epoch <= epochs; epoch += 1) {
    let totalLoss = 0;
    let correctDomain = 0;
    let totalAbsComplexityErr = 0;

    for (const sample of encodedSamples) {
      // 1. Forward pass: Dominio (Softmax)
      const logits = new Array(numClasses).fill(0);
      for (let c = 0; c < numClasses; c += 1) {
        let sum = classBias[c];
        for (const featIdx of sample.activeIndices) {
          sum += classWeights[c][featIdx] * sample.scale;
        }
        logits[c] = sum;
      }
      const probs = softmax(logits);
      const predictedClass = probs.indexOf(Math.max(...probs));
      if (predictedClass === sample.classIdx) correctDomain += 1;

      const ceLoss = -Math.log(Math.max(1e-9, probs[sample.classIdx]));

      // Backward pass: Dominio
      for (let c = 0; c < numClasses; c += 1) {
        const grad = probs[c] - (c === sample.classIdx ? 1 : 0);
        classBias[c] -= learningRate * grad * 0.25;
        for (const featIdx of sample.activeIndices) {
          classWeights[c][featIdx] =
            classWeights[c][featIdx] * (1 - learningRate * l2) -
            learningRate * grad * sample.scale;
        }
      }

      // 2. Forward pass: Complejidad (Sigmoid)
      let zComp = 0;
      for (const k of structKeys) {
        zComp += structWeights[k] * sample.struct[k];
      }
      for (const featIdx of sample.activeIndices) {
        zComp += compWeights[featIdx] * sample.scale;
      }
      const predComp = sigmoid(zComp);
      const compErr = predComp - sample.complexity;
      totalAbsComplexityErr += Math.abs(compErr);
      totalLoss += ceLoss + compErr * compErr;

      // Backward pass: Complejidad
      for (const k of structKeys) {
        structWeights[k] -= learningRate * 0.4 * compErr * sample.struct[k];
      }
      for (const featIdx of sample.activeIndices) {
        compWeights[featIdx] =
          compWeights[featIdx] * (1 - learningRate * l2) -
          learningRate * 0.65 * compErr * sample.scale;
      }
    }

    if (epoch === 1 || epoch % 45 === 0 || epoch === epochs) {
      history.push({
        epoch,
        loss: Number((totalLoss / encodedSamples.length).toFixed(4)),
        domainAccuracy: Number(((correctDomain / encodedSamples.length) * 100).toFixed(1)),
        complexityMAE: Number((totalAbsComplexityErr / encodedSamples.length).toFixed(4)),
      });
    }
  }

  const artifact = {
    trainedAt: new Date().toISOString(),
    samplesCount: encodedSamples.length,
    epochs,
    metrics: history[history.length - 1],
    history,
    domains: DOMAINS,
    vocab,
    classWeights,
    classBias,
    compWeights,
    structWeights,
  };

  fs.mkdirSync(path.dirname(WEIGHTS_PATH), { recursive: true });
  fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(artifact, null, 2));
  return artifact;
}

let cachedArtifact = null;

export function loadOrTrainModel() {
  if (cachedArtifact) return cachedArtifact;
  if (fs.existsSync(WEIGHTS_PATH)) {
    cachedArtifact = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
    return cachedArtifact;
  }
  cachedArtifact = trainRouterModel();
  return cachedArtifact;
}

/**
 * Ejecuta la inferencia sobre un prompt nuevo usando los pesos entrenados
 */
export function predictTaskProfile(text) {
  const model = loadOrTrainModel();
  const vocabIndex = new Map(model.vocab.map((tok, i) => [tok, i]));
  const tokens = extractTokens(text);

  const activeIndices = [];
  for (const t of tokens) {
    const idx = vocabIndex.get(t);
    if (idx !== undefined) activeIndices.push(idx);
  }
  const scale = 1 / Math.sqrt(Math.max(1, activeIndices.length));

  // Inferencia de Dominio
  const logits = model.domains.map((_, c) => {
    let sum = model.classBias[c];
    for (const featIdx of activeIndices) {
      sum += model.classWeights[c][featIdx] * scale;
    }
    return sum;
  });
  const probs = softmax(logits);
  let bestClassIdx = 0;
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > probs[bestClassIdx]) bestClassIdx = i;
  }

  // Inferencia de Complejidad
  const struct = extractStructuralSignals(text);
  let zComp = 0;
  for (const [k, weight] of Object.entries(model.structWeights)) {
    zComp += weight * (struct[k] ?? 0);
  }
  for (const featIdx of activeIndices) {
    zComp += model.compWeights[featIdx] * scale;
  }
  const complexity = Number(sigmoid(zComp).toFixed(2));

  return {
    domain: model.domains[bestClassIdx],
    domainConfidence: Number((probs[bestClassIdx] * 100).toFixed(1)),
    complexity,
  };
}
