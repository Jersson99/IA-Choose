import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../config.js';
import { TRAINING_SAMPLES, VALIDATION_SAMPLES } from './trainingDataset.js';

export const WEIGHTS_PATH = path.join(DATA_DIR, 'router_weights.json');

export const DOMAINS = [
  'coding',
  'math_reasoning',
  'long_context',
  'creative_writing',
  'general_qa',
];

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en',
  'con', 'por', 'para', 'sobre', 'entre', 'sin', 'como', 'que', 'es', 'son', 'mi',
  'tu', 'su', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'y', 'o', 'u', 'se'
]);

const BASIC_HINTS = new Set([
  'hola', 'mundo', 'simple', 'sencillo', 'sencilla', 'basico', 'basica', 'corto',
  'corta', 'breve', 'declarar', 'variable', 'sumar', 'dos', 'promedio', 'linea',
  'lineas', 'tres', 'frase', 'ejemplo', 'centrar', 'convertir', 'dia', 'ortografia',
  'facil', 'cumpleaños', 'saludo', 'viñetas', 'par', 'impar', 'capital'
]);

const INTERMEDIATE_HINTS = new Set([
  'componente', 'hooks', 'limpiar', 'recursiva', 'protegidas', 'mensuales',
  'controlado', 'automatizar', 'prioridad', 'expresion', 'dockerfile', 'sistema',
  'derivada', 'condicional', 'bayes', 'intervalo', 'hipotesis', 'maximos',
  'laplace', 'definida', 'cinematica', 'capitulo', 'comparar', 'entrevista',
  'argumentativo', 'podcast', 'motivacion', 'persuasivo', 'comercial', 'cronograma'
]);

const ADVANCED_HINTS = new Set([
  'refactorizar', 'microservicio', 'concurrencia', 'unitarias', 'arquitectura',
  'compilador', 'distribuido', 'consenso', 'raft', 'demostrar', 'demostracion',
  'convergencia', 'fourier', 'diferencial', 'impropia', 'residuos', 'cauchy',
  'induccion', 'asintotica', 'autovalores', 'hermitiana', 'cuantica', 'lagrange',
  'estocastico', 'estocastica', 'markov', 'tesis', 'metodologica', 'marco',
  'teorico', 'doctoral', 'exhaustiva', 'exhaustivo', 'fuga', 'optimizar',
  'particionamiento', 'auditar', 'hexagonal', 'hilbert', 'galois', 'prisma',
  'jurisprudencial', 'dialectica', 'hegeliana', 'monografia', 'bioeticas', 'crispr'
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

const DOMAIN_ROOT_CLUSTERS = {
  coding: [
    'python', 'javascript', 'java', 'react', 'css', 'html', 'sql', 'docker', 'dockerfile',
    'api', 'rest', 'endpoint', 'codigo', 'funcion', 'variable', 'arreglo', 'ciclo',
    'microservicio', 'compilador', 'concurrencia', 'algoritmo', 'recursiv', 'regex',
    'json', 'pandas', 'script', 'git', 'github', 'consola', 'memoria', 'heap', 'jwt',
    'componente', 'hooks', 'arquitectura', 'hexagonal', 'raft', 'kafka', 'query', 'postgres'
  ],
  math_reasoning: [
    'ecuacion', 'integral', 'derivad', 'matriz', 'autovalor', 'probabilidad', 'bayes',
    'estadistic', 'confianza', 'hipotesis', 'fourier', 'laplace', 'convergencia', 'serie',
    'demostrar', 'demostracion', 'induccion', 'teorema', 'calculo', 'calcular', 'porcentaje',
    'promedio', 'sumar', 'multiplicar', 'triangulo', 'hipotenusa', 'pitagoras', 'cinematica',
    'lagrange', 'markov', 'estocastic', 'sobolev', 'galois', 'hilbert', 'optimizacion', 'raiz'
  ],
  long_context: [
    'paginas', 'pdf', 'capitulo', 'libro', 'tesis', 'transcripcion', 'entrevista',
    'expediente', 'contrato', 'clausulas', 'anexos', 'licitacion', 'prisma', 'literatura',
    'resumir', 'extraer', 'parrafo', 'parrafos', 'fragmento', 'comunicado', 'circular',
    'informe', 'anteproyecto', 'hallazgos', 'marco_teorico'
  ],
  creative_writing: [
    'redactar', 'escribir', 'ensayo', 'guion', 'podcast', 'discurso', 'manifiesto',
    'carta', 'correo', 'saludo', 'felicitacion', 'cumpleaños', 'editorial', 'persuasivo',
    'narrativa', 'retorica', 'literari', 'monografia', 'poema', 'propuesta', 'reescribir',
    'diapositivas', 'perfil', 'linkedin', 'graduacion', 'ponencia', 'tratado'
  ],
  general_qa: [
    'traducir', 'ingles', 'frances', 'español', 'norma', 'normas', 'apa', 'ieee',
    'vancouver', 'bibliografi', 'cita', 'citar', 'citacion', 'ortografia', 'gramatica',
    'tildes', 'puntuacion', 'capital', 'colombia', 'planetas', 'sigla', 'nequi',
    'cronograma', 'inflacion', 'macroeconomic', 'geopolitic', 'bioetic', 'crispr',
    'constitucional', 'epistemolog'
  ],
};

/**
 * Extrae unigramas, bigramas, raíces morfológicas (stems de 4 y 5 caracteres)
 * y señales de clúster semántico por dominio para generalizar ante vocabulario no visto.
 */
export function extractTokens(raw = '') {
  const clean = normalizeText(raw);
  if (!clean) return [];
  const words = clean.split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const tokens = [...words];

  for (let i = 0; i < words.length - 1; i += 1) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }
  for (const w of words) {
    if (w.length >= 4) {
      tokens.push(`stem4:${w.slice(0, 4)}`);
    }
    if (w.length >= 5) {
      tokens.push(`stem:${w.slice(0, 5)}`);
    }
    for (const [dom, roots] of Object.entries(DOMAIN_ROOT_CLUSTERS)) {
      if (roots.some((r) => w.startsWith(r) || r.startsWith(w))) {
        tokens.push(`cluster:${dom}`);
      }
    }
  }
  return tokens;
}

// Extrae señales estructurales de complejidad además del vocabulario aprendido
export function extractStructuralSignals(raw = '') {
  const clean = normalizeText(raw);
  const words = clean ? clean.split(' ') : [];
  let basicHits = 0;
  let interHits = 0;
  let advancedHits = 0;

  for (const w of words) {
    if (BASIC_HINTS.has(w)) basicHits += 1;
    if (INTERMEDIATE_HINTS.has(w)) interHits += 1;
    if (ADVANCED_HINTS.has(w)) advancedHits += 1;
  }

  // Detectar si menciona volumen alto de páginas o artículos (ej. "45 paginas", "120 paginas")
  const pageMatch = clean.match(/(\d+)\s*(paginas|pags|articulos|hojas|capitulos)/);
  const pageCount = pageMatch ? Number(pageMatch[1]) : 0;
  const pageVolume = pageCount >= 10 ? Math.min(1, pageCount / 60) : 0;

  const wordCount = Math.max(1, words.length);
  const lengthSignal = Math.min(1, wordCount / 18);

  return {
    bias: 1.0,
    lengthSignal,
    basicRatio: basicHits / wordCount,
    interRatio: interHits / wordCount,
    advancedRatio: advancedHits / wordCount,
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
 * Evalúa un conjunto de muestras (Train o Validation) y devuelve:
 * - domainAccuracy, complexityMAE, confusionMatrix, perDomainMetrics
 */
export function evaluateDataset(samples, modelState) {
  const { domains, vocabIndex, idfWeights, classWeights, classBias, compWeights, structWeights } =
    modelState;
  const numClasses = domains.length;
  const matrix = Array.from({ length: numClasses }, () => new Array(numClasses).fill(0));

  let correctDomain = 0;
  let totalAbsErr = 0;
  let totalLoss = 0;

  for (const s of samples) {
    const tokens = extractTokens(s.text);
    const activeFeatures = [];
    let normSq = 0;

    for (const t of tokens) {
      const idx = vocabIndex.get(t);
      if (idx !== undefined) {
        const w = idfWeights[idx] || 1;
        activeFeatures.push({ idx, w });
        normSq += w * w;
      }
    }
    const norm = 1 / Math.sqrt(Math.max(1, normSq));

    const logits = new Array(numClasses).fill(0);
    for (let c = 0; c < numClasses; c += 1) {
      let sum = classBias[c];
      for (const { idx, w } of activeFeatures) {
        sum += classWeights[c][idx] * w * norm;
      }
      logits[c] = sum;
    }

    const probs = softmax(logits);
    const predIdx = probs.indexOf(Math.max(...probs));
    const trueIdx = domains.indexOf(s.domain);

    if (trueIdx >= 0) {
      matrix[trueIdx][predIdx] += 1;
      if (predIdx === trueIdx) correctDomain += 1;
      totalLoss += -Math.log(Math.max(1e-9, probs[trueIdx]));
    }

    const struct = extractStructuralSignals(s.text);
    let zComp = 0;
    for (const [k, weight] of Object.entries(structWeights)) {
      zComp += weight * (struct[k] ?? 0);
    }
    for (const { idx, w } of activeFeatures) {
      zComp += compWeights[idx] * w * norm;
    }
    const predComp = sigmoid(zComp);
    const err = predComp - s.complexity;
    totalAbsErr += Math.abs(err);
    totalLoss += err * err;
  }

  const perDomain = domains.map((dom, c) => {
    const tp = matrix[c][c];
    const fp = matrix.reduce((acc, row, r) => (r !== c ? acc + row[c] : acc), 0);
    const fn = matrix[c].reduce((acc, val, col) => (col !== c ? acc + val : acc), 0);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return {
      domain: dom,
      support: tp + fn,
      precision: Number((precision * 100).toFixed(1)),
      recall: Number((recall * 100).toFixed(1)),
      f1: Number((f1 * 100).toFixed(1)),
    };
  });

  const macroF1 = Number(
    (perDomain.reduce((acc, d) => acc + d.f1, 0) / Math.max(1, perDomain.length)).toFixed(1)
  );

  return {
    count: samples.length,
    loss: Number((totalLoss / Math.max(1, samples.length)).toFixed(4)),
    domainAccuracy: Number(((correctDomain / Math.max(1, samples.length)) * 100).toFixed(1)),
    complexityMAE: Number((totalAbsErr / Math.max(1, samples.length)).toFixed(4)),
    macroF1,
    confusionMatrix: matrix,
    perDomain,
  };
}

/**
 * Entrena el modelo sobre TRAINING_SAMPLES (80%) y evalúa en cada corte sobre VALIDATION_SAMPLES (20%)
 */
export function trainRouterModel({ epochs = 200, learningRate = 0.38, l2 = 0.0006 } = {}) {
  const docFreq = new Map();
  for (const sample of TRAINING_SAMPLES) {
    const uniqueTokens = new Set(extractTokens(sample.text));
    for (const tok of uniqueTokens) {
      docFreq.set(tok, (docFreq.get(tok) || 0) + 1);
    }
  }

  const vocab = Array.from(docFreq.keys());
  const vocabIndex = new Map(vocab.map((tok, i) => [tok, i]));
  const N = TRAINING_SAMPLES.length;
  const idfWeights = vocab.map((tok) =>
    Number((Math.log((N + 1) / ((docFreq.get(tok) || 1) + 1)) + 1).toFixed(4))
  );

  const numFeatures = vocab.length;
  const numClasses = DOMAINS.length;

  const classWeights = Array.from({ length: numClasses }, () => new Array(numFeatures).fill(0));
  const classBias = new Array(numClasses).fill(0);
  const compWeights = new Array(numFeatures).fill(0);

  const structKeys = ['bias', 'lengthSignal', 'basicRatio', 'interRatio', 'advancedRatio', 'pageVolume'];
  const structWeights = {
    bias: -0.5,
    lengthSignal: 0.65,
    basicRatio: -2.4,
    interRatio: 0.45,
    advancedRatio: 2.5,
    pageVolume: 1.6,
  };

  // Pre-vectorizar muestras de entrenamiento con ponderación TF-IDF
  const encodedTrain = TRAINING_SAMPLES.map((s) => {
    const tokens = extractTokens(s.text);
    const activeFeatures = [];
    let normSq = 0;
    for (const t of tokens) {
      const idx = vocabIndex.get(t);
      if (idx !== undefined) {
        const w = idfWeights[idx];
        activeFeatures.push({ idx, w });
        normSq += w * w;
      }
    }
    return {
      ...s,
      classIdx: DOMAINS.indexOf(s.domain),
      activeFeatures,
      norm: 1 / Math.sqrt(Math.max(1, normSq)),
      struct: extractStructuralSignals(s.text),
    };
  });

  const history = [];
  let bestValScore = -Infinity;
  let bestSnapshot = null;

  for (let epoch = 1; epoch <= epochs; epoch += 1) {
    for (const sample of encodedTrain) {
      // 1. Forward pass: Dominio (Softmax)
      const logits = new Array(numClasses).fill(0);
      for (let c = 0; c < numClasses; c += 1) {
        let sum = classBias[c];
        for (const { idx, w } of sample.activeFeatures) {
          sum += classWeights[c][idx] * w * sample.norm;
        }
        logits[c] = sum;
      }
      const probs = softmax(logits);

      // Backward pass: Dominio (con regularización sobre classBias para evitar sesgo por frecuencia de clase)
      for (let c = 0; c < numClasses; c += 1) {
        const grad = probs[c] - (c === sample.classIdx ? 1 : 0);
        classBias[c] = classBias[c] * 0.95 - learningRate * grad * 0.04;
        for (const { idx, w } of sample.activeFeatures) {
          classWeights[c][idx] =
            classWeights[c][idx] * (1 - learningRate * l2) -
            learningRate * grad * w * sample.norm;
        }
      }

      // 2. Forward pass: Complejidad (Sigmoid)
      let zComp = 0;
      for (const k of structKeys) {
        zComp += structWeights[k] * sample.struct[k];
      }
      for (const { idx, w } of sample.activeFeatures) {
        zComp += compWeights[idx] * w * sample.norm;
      }
      const predComp = sigmoid(zComp);
      const compErr = predComp - sample.complexity;

      // Backward pass: Complejidad
      for (const k of structKeys) {
        structWeights[k] -= learningRate * 0.35 * compErr * sample.struct[k];
      }
      for (const { idx, w } of sample.activeFeatures) {
        compWeights[idx] =
          compWeights[idx] * (1 - learningRate * l2) -
          learningRate * 0.6 * compErr * w * sample.norm;
      }
    }

    if (epoch === 1 || epoch % 50 === 0 || epoch === epochs) {
      const state = {
        domains: DOMAINS,
        vocabIndex,
        idfWeights,
        classWeights,
        classBias,
        compWeights,
        structWeights,
      };
      const trainEval = evaluateDataset(TRAINING_SAMPLES, state);
      const valEval = evaluateDataset(VALIDATION_SAMPLES, state);
      const valScore = valEval.macroF1 - valEval.complexityMAE * 25;
      if (valScore >= bestValScore) {
        bestValScore = valScore;
        bestSnapshot = {
          classWeights: classWeights.map((row) => [...row]),
          classBias: [...classBias],
          compWeights: [...compWeights],
          structWeights: { ...structWeights },
        };
      }
      history.push({
        epoch,
        loss: trainEval.loss,
        trainAccuracy: trainEval.domainAccuracy,
        valAccuracy: valEval.domainAccuracy,
        trainMAE: trainEval.complexityMAE,
        valMAE: valEval.complexityMAE,
        valMacroF1: valEval.macroF1,
      });
    }
  }

  const chosenWeights = bestSnapshot || {
    classWeights,
    classBias,
    compWeights,
    structWeights,
  };

  const finalState = {
    domains: DOMAINS,
    vocabIndex,
    idfWeights,
    classWeights: chosenWeights.classWeights,
    classBias: chosenWeights.classBias,
    compWeights: chosenWeights.compWeights,
    structWeights: chosenWeights.structWeights,
  };
  const trainReport = evaluateDataset(TRAINING_SAMPLES, finalState);
  const validationReport = evaluateDataset(VALIDATION_SAMPLES, finalState);

  const artifact = {
    trainedAt: new Date().toISOString(),
    trainSamplesCount: TRAINING_SAMPLES.length,
    validationSamplesCount: VALIDATION_SAMPLES.length,
    epochs,
    trainReport,
    validationReport,
    history,
    domains: DOMAINS,
    vocab,
    idfWeights,
    classWeights: chosenWeights.classWeights,
    classBias: chosenWeights.classBias,
    compWeights: chosenWeights.compWeights,
    structWeights: chosenWeights.structWeights,
  };

  fs.mkdirSync(path.dirname(WEIGHTS_PATH), { recursive: true });
  fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(artifact, null, 2));
  cachedArtifact = artifact;
  return artifact;
}

let cachedArtifact = null;

export function loadOrTrainModel() {
  if (cachedArtifact) return cachedArtifact;
  if (fs.existsSync(WEIGHTS_PATH)) {
    const parsed = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
    if (parsed.idfWeights && parsed.domains?.length === DOMAINS.length) {
      cachedArtifact = parsed;
      return cachedArtifact;
    }
  }
  cachedArtifact = trainRouterModel();
  return cachedArtifact;
}

/**
 * Ejecuta la inferencia sobre un prompt nuevo usando los pesos TF-IDF entrenados
 */
export function predictTaskProfile(text) {
  const model = loadOrTrainModel();
  const vocabIndex = new Map(model.vocab.map((tok, i) => [tok, i]));
  const tokens = extractTokens(text);

  const activeFeatures = [];
  let normSq = 0;
  for (const t of tokens) {
    const idx = vocabIndex.get(t);
    if (idx !== undefined) {
      const w = model.idfWeights?.[idx] || 1;
      activeFeatures.push({ idx, w });
      normSq += w * w;
    }
  }
  const norm = 1 / Math.sqrt(Math.max(1, normSq));

  const logits = model.domains.map((_, c) => {
    let sum = model.classBias[c];
    for (const { idx, w } of activeFeatures) {
      sum += model.classWeights[c][idx] * w * norm;
    }
    return sum;
  });
  const probs = softmax(logits);
  let bestClassIdx = 0;
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > probs[bestClassIdx]) bestClassIdx = i;
  }

  const struct = extractStructuralSignals(text);
  let zComp = 0;
  for (const [k, weight] of Object.entries(model.structWeights)) {
    zComp += weight * (struct[k] ?? 0);
  }
  for (const { idx, w } of activeFeatures) {
    zComp += model.compWeights[idx] * w * norm;
  }
  const complexity = Number(sigmoid(zComp).toFixed(2));

  return {
    domain: model.domains[bestClassIdx],
    domainConfidence: Number((probs[bestClassIdx] * 100).toFixed(1)),
    complexity,
  };
}
