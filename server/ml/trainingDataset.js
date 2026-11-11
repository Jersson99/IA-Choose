/**
 * Dataset supervisado de entrenamiento para el Enrutador de IA (IA CHOOSE).
 * Cada ejemplo relaciona un prompt de usuario con:
 * - domain: 'coding' | 'math_reasoning' | 'long_context' | 'general_qa'
 * - complexity: valor continuo entre 0.10 (tarea básica/trivial) y 0.96 (tarea crítica de frontera)
 */
export const TRAINING_SAMPLES = [
  // ================= CODING: TAREAS BÁSICAS (Complejidad baja -> Evita gastar en Claude/Fable) =================
  { text: 'haz un hola mundo en python', domain: 'coding', complexity: 0.12 },
  { text: 'como declarar una variable en javascript', domain: 'coding', complexity: 0.14 },
  { text: 'funcion simple para sumar dos numeros en java', domain: 'coding', complexity: 0.16 },
  { text: 'como centrar un div en css con flexbox', domain: 'coding', complexity: 0.18 },
  { text: 'ejemplo basico de un ciclo for en python', domain: 'coding', complexity: 0.15 },
  { text: 'que significa un error de sintaxis en una linea de codigo', domain: 'coding', complexity: 0.20 },
  { text: 'crear una lista en html con tres elementos', domain: 'coding', complexity: 0.12 },
  { text: 'convertir un string a entero en javascript', domain: 'coding', complexity: 0.15 },

  // ================= CODING: TAREAS COMPLEJAS / ARQUITECTURA (Complejidad alta -> Requiere alto SWE-bench) =================
  { text: 'refactorizar microservicio en python con programacion dinamica concurrencia y pruebas unitarias', domain: 'coding', complexity: 0.84 },
  { text: 'depurar race condition en servidor nodejs con express sqlite y disenar arquitectura limpia', domain: 'coding', complexity: 0.86 },
  { text: 'implementar compilador lexico y sintactico en rust con manejo de memoria segura y arbol ast', domain: 'coding', complexity: 0.94 },
  { text: 'optimizar consulta sql compleja con multiples joins indices compuestos y particionamiento en postgres', domain: 'coding', complexity: 0.78 },
  { text: 'crear arquitectura fullstack react y express con autenticacion jwt oauth2 y middleware de seguridad', domain: 'coding', complexity: 0.82 },
  { text: 'corregir bug critico de fuga de memoria en aplicacion typescript con websockets en tiempo real', domain: 'coding', complexity: 0.85 },
  { text: 'disenar sistema distribuido tolerante a fallos con consenso raft y replicacion asincrona de estado', domain: 'coding', complexity: 0.95 },
  { text: 'programar algoritmo de grafos dijkstra y flujo maximo con pruebas de rendimiento en c++', domain: 'coding', complexity: 0.80 },

  // ================= MATH & REASONING: TAREAS BÁSICAS =================
  { text: 'cuanto es 25 por 14 mas 10', domain: 'math_reasoning', complexity: 0.10 },
  { text: 'calcular el promedio de cinco notas de un examen', domain: 'math_reasoning', complexity: 0.16 },
  { text: 'cual es la formula del area de un triangulo y un circulo', domain: 'math_reasoning', complexity: 0.14 },
  { text: 'convertir 50 kilometros por hora a metros por segundo', domain: 'math_reasoning', complexity: 0.18 },
  { text: 'despejar x en la ecuacion lineal 2x mas 4 igual a 10', domain: 'math_reasoning', complexity: 0.18 },

  // ================= MATH & REASONING: TAREAS AVANZADAS (Requiere alto MATH-500 / DeepSeek R1) =================
  { text: 'demostrar paso a paso la convergencia de una serie de fourier y resolver ecuacion diferencial parcial', domain: 'math_reasoning', complexity: 0.88 },
  { text: 'resolver integral impropia por analisis complejo usando el teorema de los residuos de cauchy', domain: 'math_reasoning', complexity: 0.86 },
  { text: 'demostracion formal por induccion matematica y complejidad asintotica np completo', domain: 'math_reasoning', complexity: 0.85 },
  { text: 'calcular autovalores y diagonalizar matriz hermitiana en mecanica cuantica paso a paso', domain: 'math_reasoning', complexity: 0.84 },
  { text: 'optimizacion no lineal con multiplicadores de lagrange y condiciones de karush kuhn tucker', domain: 'math_reasoning', complexity: 0.87 },
  { text: 'resolver sistema estocastico con cadenas de markov y demostrar ergodicidad rigurosa', domain: 'math_reasoning', complexity: 0.93 },

  // ================= LONG CONTEXT / LECTURA ACADÉMICA: BÁSICAS vs EXTENSAS (Moonshot Kimi K2) =================
  { text: 'resumir este parrafo corto de tres lineas en una frase', domain: 'long_context', complexity: 0.15 },
  { text: 'sacar la idea principal de una nota breve de clase', domain: 'long_context', complexity: 0.18 },
  { text: 'analizar pdf de tesis de 45 paginas extraer citas clave y verificar coherencia metodologica', domain: 'long_context', complexity: 0.76 },
  { text: 'leer marco teorico extenso de 60 paginas comparar autores y sintetizar estado del arte', domain: 'long_context', complexity: 0.80 },
  { text: 'revisar documento completo de investigacion universitaria libros y articulos cientificos extensos', domain: 'long_context', complexity: 0.75 },
  { text: 'extraer hallazgos metodologicos y tablas de un informe tecnico en pdf de 80 paginas', domain: 'long_context', complexity: 0.82 },
  { text: 'auditar contrato legal completo de 120 paginas cruzando clausulas y anexos regulatorios', domain: 'long_context', complexity: 0.94 },

  // ================= GENERAL QA / FORMATO APA / TRADUCCIÓN =================
  { text: 'traducir hola buenos dias al ingles', domain: 'general_qa', complexity: 0.10 },
  { text: 'formatear esta referencia bibliografica en norma apa 7 edicion', domain: 'general_qa', complexity: 0.24 },
  { text: 'corregir ortografia de un correo corto para un profesor universitario', domain: 'general_qa', complexity: 0.20 },
  { text: 'traducir 20 resumenes de articulos cientificos al espanol y normalizar bibliografia en apa 7', domain: 'general_qa', complexity: 0.32 },
  { text: 'que dia es hoy o dame ideas de nombres para un grupo de estudio', domain: 'general_qa', complexity: 0.12 },
  { text: 'redactar introduccion breve para una presentacion de diapositivas', domain: 'general_qa', complexity: 0.22 },
  { text: 'sintetizar epistemologia comparada multidisciplinaria con critica filosofica exhaustiva de nivel doctoral', domain: 'general_qa', complexity: 0.94 },
];
