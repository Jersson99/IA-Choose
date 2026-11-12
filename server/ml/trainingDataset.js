/**
 * Dataset supervisado y estratificado para el entrenamiento y validación del Enrutador IA CHOOSE.
 * Dominios (5):
 *   - 'coding'           -> Benchmark: SWE-bench Verified
 *   - 'math_reasoning'   -> Benchmark: MATH-500 / GPQA
 *   - 'long_context'     -> Benchmark: LongBench (Documentos y PDFs extensos)
 *   - 'creative_writing' -> Benchmark: Arena-Hard Writing (Redacción, ensayo y estilo)
 *   - 'general_qa'       -> Benchmark: MMLU-Pro (Consultas generales, traducción, APA)
 *
 * Complejidad continua (0.08 a 0.96):
 *   - 0.08 - 0.35: Básica (debe enrutar a modelos económicos de $9 - $11 COP)
 *   - 0.36 - 0.68: Intermedia (especialistas costo-eficientes de $11 - $18 COP)
 *   - 0.69 - 0.90: Avanzada (líderes de dominio de $14 - $58 COP sin gastar en Ultra)
 *   - 0.91 - 0.98: Frontera / Extrema (desbloquea tier Ultra cuando es indispensable)
 */

export const ALL_LABELED_SAMPLES = [
  // =========================================================================
  // 1. DOMINIO: CODING (SWE-bench)
  // =========================================================================
  // --- Básicas (0.10 - 0.32) ---
  { text: 'haz un hola mundo en python', domain: 'coding', complexity: 0.10 },
  { text: 'como declarar una variable constante en javascript', domain: 'coding', complexity: 0.12 },
  { text: 'funcion simple para sumar dos numeros en java y retornar el resultado', domain: 'coding', complexity: 0.15 },
  { text: 'como centrar un div en css usando flexbox', domain: 'coding', complexity: 0.16 },
  { text: 'ejemplo basico de un ciclo for y while en python', domain: 'coding', complexity: 0.14 },
  { text: 'que significa un error de sintaxis syntaxerror en una linea de codigo', domain: 'coding', complexity: 0.18 },
  { text: 'crear una lista desordenada en html con tres elementos li', domain: 'coding', complexity: 0.11 },
  { text: 'convertir un string de texto a numero entero en javascript con parseint', domain: 'coding', complexity: 0.15 },
  { text: 'como imprimir los elementos de un arreglo en consola con foreach', domain: 'coding', complexity: 0.16 },
  { text: 'cambiar el color de fondo de un boton en css al pasar el mouse hover', domain: 'coding', complexity: 0.14 },
  { text: 'explicame en dos lineas que es python y para que sirve programar', domain: 'coding', complexity: 0.15, isTrap: true },
  { text: 'cual es la diferencia basica entre let y const en javascript con un ejemplo corto', domain: 'coding', complexity: 0.18, isTrap: true },
  { text: 'como comentar varias lineas de codigo en lenguaje c y python', domain: 'coding', complexity: 0.12 },
  { text: 'hacer un select simple en sql para traer todos los usuarios de una tabla', domain: 'coding', complexity: 0.19 },
  { text: 'crear una funcion sencilla en python que diga si un numero es par o impar', domain: 'coding', complexity: 0.16 },
  { text: 'como instalar un paquete con npm install en la terminal de nodejs', domain: 'coding', complexity: 0.15 },

  // --- Intermedias (0.40 - 0.65) ---
  { text: 'crear un componente en react con hooks usestate y useeffect para consumir una api rest', domain: 'coding', complexity: 0.48 },
  { text: 'escribir un script en python con pandas para limpiar valores nulos de un archivo csv', domain: 'coding', complexity: 0.50 },
  { text: 'implementar busqueda binaria recursiva en c++ y analizar su caso base', domain: 'coding', complexity: 0.52 },
  { text: 'configurar rutas protegidas en express con middleware de validacion de esquema', domain: 'coding', complexity: 0.55 },
  { text: 'consulta sql con inner join group by y having para calcular ventas mensuales por cliente', domain: 'coding', complexity: 0.54 },
  { text: 'crear formulario controlado en react con validacion de correo y manejo de errores', domain: 'coding', complexity: 0.46 },
  { text: 'automatizar pruebas de endpoints rest en nodejs usando jest y supertest', domain: 'coding', complexity: 0.58 },
  { text: 'implementar una cola de prioridad usando un heap binario en java', domain: 'coding', complexity: 0.60 },
  { text: 'escribir expresion regular regex en javascript para validar contraseñas seguras', domain: 'coding', complexity: 0.45 },
  { text: 'crear dockerfile multietapa para empaquetar una aplicacion web de nodejs y vite', domain: 'coding', complexity: 0.56 },

  // --- Avanzadas y Frontera (0.74 - 0.95) ---
  { text: 'refactorizar microservicio en python con programacion dinamica concurrencia asyncio y pruebas unitarias', domain: 'coding', complexity: 0.84 },
  { text: 'depurar race condition en servidor nodejs con express sqlite y disenar arquitectura limpia hexagonal', domain: 'coding', complexity: 0.86 },
  { text: 'implementar compilador lexico y sintactico en rust con manejo de memoria segura y arbol ast', domain: 'coding', complexity: 0.94 },
  { text: 'optimizar consulta sql compleja con multiples joins indices compuestos y particionamiento en postgres', domain: 'coding', complexity: 0.78 },
  { text: 'crear arquitectura fullstack react y express con autenticacion jwt oauth2 rotacion de tokens y seguridad', domain: 'coding', complexity: 0.82 },
  { text: 'corregir bug critico de fuga de memoria memory leak en aplicacion typescript con websockets en tiempo real', domain: 'coding', complexity: 0.85 },
  { text: 'disenar sistema distribuido tolerante a fallos con consenso raft y replicacion asincrona de estado', domain: 'coding', complexity: 0.95 },
  { text: 'programar algoritmo de grafos dijkstra y flujo maximo ford fulkerson con pruebas de rendimiento en c++', domain: 'coding', complexity: 0.81 },
  { text: 'arquitectura de motor de base de datos embebido con arbol b+ control de concurrencia mvcc y wal', domain: 'coding', complexity: 0.94 },
  { text: 'refactorizar sistema heredado monolitico a arquitectura orientada a eventos con CQRS y manejo de transacciones', domain: 'coding', complexity: 0.86 },
  { text: 'implementar recolector de basura mark and sweep concurrente y analizar pausas de latencia en tiempo de ejecucion', domain: 'coding', complexity: 0.93 },
  { text: 'auditar vulnerabilidades de inyeccion sql desborde de buffer y condiciones de carrera en backend de pagos', domain: 'coding', complexity: 0.83 },

  // =========================================================================
  // 2. DOMINIO: MATH & REASONING (MATH-500 / GPQA)
  // =========================================================================
  // --- Básicas (0.10 - 0.30) ---
  { text: 'cuanto es 25 por 14 mas 10', domain: 'math_reasoning', complexity: 0.10 },
  { text: 'calcular el promedio aritmetico de cinco notas de un examen universitario', domain: 'math_reasoning', complexity: 0.15 },
  { text: 'cual es la formula del area de un triangulo y el perimetro de un circulo', domain: 'math_reasoning', complexity: 0.13 },
  { text: 'convertir 50 kilometros por hora a metros por segundo paso facil', domain: 'math_reasoning', complexity: 0.16 },
  { text: 'despejar la incognita x en la ecuacion lineal simple 2x mas 4 igual a 10', domain: 'math_reasoning', complexity: 0.18, isTrap: true },
  { text: 'calcular el 19 por ciento de iva de un producto que cuesta 80000 pesos', domain: 'math_reasoning', complexity: 0.14 },
  { text: 'como sumar dos fracciones con diferente denominador ejemplo sencillo', domain: 'math_reasoning', complexity: 0.15 },
  { text: 'aplicar teorema de pitagoras para hallar la hipotenusa de catetos 3 y 4', domain: 'math_reasoning', complexity: 0.19 },
  { text: 'que es un numero primo y cuales son los primeros diez numeros primos', domain: 'math_reasoning', complexity: 0.12 },
  { text: 'regla de tres simple para calcular ingredientes de una receta para 8 personas', domain: 'math_reasoning', complexity: 0.14 },

  // --- Intermedias (0.42 - 0.66) ---
  { text: 'resolver sistema de tres ecuaciones lineales usando eliminacion de gauss jordan paso a paso', domain: 'math_reasoning', complexity: 0.52 },
  { text: 'calcular la derivada por regla de la cadena de una funcion trigonometrica compuesta', domain: 'math_reasoning', complexity: 0.48 },
  { text: 'resolver problema de probabilidad condicional aplicando el teorema de bayes con arbol de decision', domain: 'math_reasoning', complexity: 0.56 },
  { text: 'calcular intervalo de confianza del 95 por ciento y prueba de hipotesis t de student para dos muestras', domain: 'math_reasoning', complexity: 0.58 },
  { text: 'hallar maximos y minimos locales de una funcion polinomial usando criterio de la segunda derivada', domain: 'math_reasoning', complexity: 0.50 },
  { text: 'calcular transformada de laplace de una ecuacion diferencial ordinaria de segundo orden con condiciones iniciales', domain: 'math_reasoning', complexity: 0.64 },
  { text: 'resolver integral definida mediante sustitucion trigonometrica e integracion por partes', domain: 'math_reasoning', complexity: 0.55 },
  { text: 'analizar cinematica y dinamica de un bloque en plano inclinado con rozamiento y poleas en fisica', domain: 'math_reasoning', complexity: 0.54 },

  // --- Avanzadas y Frontera (0.75 - 0.96) ---
  { text: 'demostrar paso a paso la convergencia uniforme de una serie de fourier y resolver ecuacion diferencial parcial', domain: 'math_reasoning', complexity: 0.88 },
  { text: 'resolver integral impropia por analisis complejo usando el teorema de los residuos de cauchy y contorno', domain: 'math_reasoning', complexity: 0.86 },
  { text: 'demostracion formal por induccion matematica estructural y reduccion polinomial de complejidad np completo', domain: 'math_reasoning', complexity: 0.87 },
  { text: 'calcular autovalores y diagonalizar matriz hermitiana de operadores en mecanica cuantica paso a paso', domain: 'math_reasoning', complexity: 0.85 },
  { text: 'optimizacion convexa no lineal con multiplicadores de lagrange y condiciones de karush kuhn tucker kkt', domain: 'math_reasoning', complexity: 0.87 },
  { text: 'resolver sistema estocastico con cadenas de markov en tiempo continuo y demostrar ergodicidad rigurosa', domain: 'math_reasoning', complexity: 0.93 },
  { text: 'demostrar teorema espectral en espacios de hilbert de dimension infinita para operadores compactos autoadjuntos', domain: 'math_reasoning', complexity: 0.95 },
  { text: 'formular ecuaciones de euler lagrange y hamiltoniano para un sistema de pendulo doble caotico no lineal', domain: 'math_reasoning', complexity: 0.84 },
  { text: 'demostracion rigurosa de teoria de galois sobre insolubilidad por radicales de polinomios de grado cinco', domain: 'math_reasoning', complexity: 0.94 },
  { text: 'resolver ecuacion diferencial estocastica de ito aplicando el lema de ito en valoracion de derivados', domain: 'math_reasoning', complexity: 0.86 },

  // =========================================================================
  // 3. DOMINIO: LONG CONTEXT / LECTURA ACADÉMICA Y PDF (LongBench)
  // =========================================================================
  // --- Básicas (0.12 - 0.32) ---
  { text: 'resumir este parrafo corto de tres lineas en una sola frase clara', domain: 'long_context', complexity: 0.14 },
  { text: 'sacar la idea principal de una nota breve de clase de media pagina', domain: 'long_context', complexity: 0.18 },
  { text: 'extraer tres puntos clave de este comunicado corto de la universidad', domain: 'long_context', complexity: 0.16 },
  { text: 'hacer una lista de viñetas con las fechas mencionadas en este texto corto de un parrafo', domain: 'long_context', complexity: 0.15 },
  { text: 'dime de que trata el titulo y el resumen corto de una pagina de mi tesis', domain: 'long_context', complexity: 0.22, isTrap: true },
  { text: 'identificar el autor y año de publicacion en este fragmento corto de dos parrafos', domain: 'long_context', complexity: 0.14 },
  { text: 'resumir en tres puntos breves una circular informativa corta de una pagina en pdf', domain: 'long_context', complexity: 0.19, isTrap: true },
  { text: 'extraer las palabras clave del abstract corto de este articulo universitario', domain: 'long_context', complexity: 0.20 },
  { text: 'sintetizar un recorte periodistico corto de dos parrafos en una sola oracion', domain: 'long_context', complexity: 0.15 },

  // --- Intermedias (0.45 - 0.68) ---
  { text: 'resumir un capitulo de libro de 15 paginas identificando argumentos principales y secundarios', domain: 'long_context', complexity: 0.54 },
  { text: 'comparar dos articulos cientificos de 12 paginas cada uno sobre energias renovables en colombia', domain: 'long_context', complexity: 0.60 },
  { text: 'extraer todas las definiciones conceptuales y variables de un documento pdf de 20 paginas', domain: 'long_context', complexity: 0.56 },
  { text: 'analizar transcripcion completa de una entrevista academica de 18 paginas y agrupar categorias', domain: 'long_context', complexity: 0.58 },
  { text: 'sintetizar guia metodologica de 25 paginas en una matriz de objetivos e indicadores', domain: 'long_context', complexity: 0.62 },
  { text: 'revisar coherencia entre objetivos especificos y conclusiones en un anteproyecto de 22 paginas', domain: 'long_context', complexity: 0.64 },
  { text: 'resumir informe financiero trimestral de 16 paginas en pdf destacando ingresos y gastos operativos', domain: 'long_context', complexity: 0.55 },
  { text: 'extraer metodologia y tamaño de muestra de tres articulos cientificos en pdf de 14 paginas', domain: 'long_context', complexity: 0.59 },
  { text: 'comparar los puntos de vista de dos autores en una lectura academica extensa de 20 paginas', domain: 'long_context', complexity: 0.57 },

  // --- Avanzadas y Frontera (0.74 - 0.95) ---
  { text: 'analizar pdf de tesis de 45 paginas extraer citas clave y verificar coherencia metodologica completa', domain: 'long_context', complexity: 0.79 },
  { text: 'leer marco teorico extenso de 60 paginas comparar posturas de autores y sintetizar estado del arte', domain: 'long_context', complexity: 0.82 },
  { text: 'revisar documento completo de investigacion universitaria libros y multiples articulos cientificos extensos de 50 paginas', domain: 'long_context', complexity: 0.78 },
  { text: 'extraer hallazgos metodologicos tablas estadisticas y limitaciones de un informe tecnico en pdf de 80 paginas', domain: 'long_context', complexity: 0.84 },
  { text: 'auditar contrato legal e informe financiero completo de 120 paginas cruzando clausulas y anexos regulatorios', domain: 'long_context', complexity: 0.94 },
  { text: 'realizar revision sistematica de literatura cruzando 35 articulos extensos en pdf y construir matriz prisma', domain: 'long_context', complexity: 0.89 },
  { text: 'analizar expediente jurisprudencial completo de 150 paginas detectando contradicciones fácticas y precedentes', domain: 'long_context', complexity: 0.95 },
  { text: 'evaluar tesis doctoral de 90 paginas contrastando hipotesis resultados empiricos y discusion bibliografica', domain: 'long_context', complexity: 0.86 },
  { text: 'sintetizar memoria institucional y anexos tecnicos de 110 paginas en pdf cruzando indicadores multianuales', domain: 'long_context', complexity: 0.92 },
  { text: 'auditar pliego de licitacion publica de 75 paginas en pdf verificando requisitos juridicos y financieros', domain: 'long_context', complexity: 0.83 },

  // =========================================================================
  // 4. DOMINIO: CREATIVE WRITING / REDACCIÓN Y ENSAYO (Arena-Hard Writing)
  // =========================================================================
  // --- Básicas (0.12 - 0.32) ---
  { text: 'escribir un mensaje corto de felicitacion de cumpleaños para un compañero de estudio', domain: 'creative_writing', complexity: 0.12 },
  { text: 'redactar un correo breve pidiendo prorroga de un dia para entregar una tarea al profesor', domain: 'creative_writing', complexity: 0.18 },
  { text: 'dame cinco ideas de titulos llamativos para una exposicion escolar sobre reciclaje', domain: 'creative_writing', complexity: 0.15 },
  { text: 'escribir una descripcion corta de dos lineas para mi perfil profesional de linkedin', domain: 'creative_writing', complexity: 0.16 },
  { text: 'redactar introduccion breve y sencilla de un parrafo para una presentacion de diapositivas', domain: 'creative_writing', complexity: 0.20 },
  { text: 'crear un saludo cordial de bienvenida para un evento estudiantil universitario', domain: 'creative_writing', complexity: 0.14 },
  { text: 'escribir una frase corta de agradecimiento para poner al final de mi exposicion', domain: 'creative_writing', complexity: 0.12 },
  { text: 'redactar una nota breve invitando a mis compañeros a una reunion de grupo mañana', domain: 'creative_writing', complexity: 0.15 },
  { text: 'escribir un post corto y sencillo de tres lineas anunciando un taller de python para principiantes', domain: 'creative_writing', complexity: 0.21, isTrap: true },

  // --- Intermedias (0.42 - 0.66) ---
  { text: 'redactar un ensayo argumentativo de cinco parrafos sobre el impacto etico de la inteligencia artificial en la educacion', domain: 'creative_writing', complexity: 0.54 },
  { text: 'escribir guion estructurado para un podcast universitario de 10 minutos con tono divulgativo y dinamico', domain: 'creative_writing', complexity: 0.50 },
  { text: 'elaborar carta de motivacion academica para aplicar a una beca de posgrado internacional en ingenieria', domain: 'creative_writing', complexity: 0.56 },
  { text: 'reescribir este texto tecnico con estilo editorial persuasivo claro y fluido para un articulo de blog', domain: 'creative_writing', complexity: 0.48 },
  { text: 'redactar propuesta comercial estructurada para presentar un proyecto de software a inversores locales', domain: 'creative_writing', complexity: 0.60 },
  { text: 'construir narrativa de caso de estudio UX explicando el problema de investigacion y las decisiones de diseño', domain: 'creative_writing', complexity: 0.58 },
  { text: 'redactar un articulo de divulgacion de seis parrafos con tono narrativo sobre la historia de internet', domain: 'creative_writing', complexity: 0.52 },
  { text: 'escribir discurso de graduacion emotivo y bien estructurado para ceremonia universitaria de pregrado', domain: 'creative_writing', complexity: 0.55 },
  { text: 'elaborar comunicado de prensa formal y persuasivo para el lanzamiento de una iniciativa academica', domain: 'creative_writing', complexity: 0.49 },

  // --- Avanzadas y Frontera (0.74 - 0.94) ---
  { text: 'redactar ensayo filosofico y epistemologico profundo con estructura dialectica hegeliana y rigor academico', domain: 'creative_writing', complexity: 0.84 },
  { text: 'escribir articulo de opinion editorial de alto nivel analizando politica monetaria y transformacion digital con retorica clasica', domain: 'creative_writing', complexity: 0.80 },
  { text: 'desarrollar discurso magistral de apertura academica con figuras retoricas avanzadas cadencia literaria y sintesis historica', domain: 'creative_writing', complexity: 0.82 },
  { text: 'componer monografia critica comparada sobre literatura latinoamericana del siglo veinte con analisis estilistico exhaustivo', domain: 'creative_writing', complexity: 0.92 },
  { text: 'redactar manifiesto de producto y documento de vision estrategica con rigor editorial ejecutivo y narrativa de categoria', domain: 'creative_writing', complexity: 0.78 },
  { text: 'escribir ensayo literario extenso con multiples arcos dramaticos metaforas sensoriales y critica cultural contemporanea', domain: 'creative_writing', complexity: 0.85 },
  { text: 'elaborar ponencia magistral con estructura retorica clasica argumentacion contrafactual y estilo editorial impecable', domain: 'creative_writing', complexity: 0.83 },
  { text: 'redactar tratado ensayistico interdisciplinario sobre estetica filosofia de la mente y creatividad humana con prosa academica', domain: 'creative_writing', complexity: 0.91 },

  // =========================================================================
  // 5. DOMINIO: GENERAL QA / FORMATO APA / TRADUCCIÓN (MMLU-Pro)
  // =========================================================================
  // --- Básicas (0.10 - 0.34) ---
  { text: 'traducir hola buenos dias como estas al ingles y frances', domain: 'general_qa', complexity: 0.10 },
  { text: 'formatear esta referencia bibliografica de un libro en norma apa 7 edicion', domain: 'general_qa', complexity: 0.22 },
  { text: 'corregir la ortografia y tildes de esta oracion corta en español', domain: 'general_qa', complexity: 0.14 },
  { text: 'cual es la capital de colombia y cuantos departamentos tiene el pais', domain: 'general_qa', complexity: 0.10 },
  { text: 'traducir un parrafo sencillo del ingles al español manteniendo el sentido original', domain: 'general_qa', complexity: 0.18 },
  { text: 'que significa la sigla pse y nequi en pagos digitales de colombia', domain: 'general_qa', complexity: 0.14 },
  { text: 'dame una tabla simple con los planetas del sistema solar ordenados por tamaño', domain: 'general_qa', complexity: 0.15 },
  { text: 'como se cita un articulo de pagina web sin fecha segun las normas apa septima edicion', domain: 'general_qa', complexity: 0.24 },
  { text: 'como se cita una tesis de grado en formato apa 7 edicion con un ejemplo breve', domain: 'general_qa', complexity: 0.23, isTrap: true },
  { text: 'cual es la diferencia basica entre cita textual corta y parafraseo en normas apa', domain: 'general_qa', complexity: 0.20 },
  { text: 'corregir la puntuacion y gramatica de este mensaje corto de dos renglones', domain: 'general_qa', complexity: 0.14 },

  // --- Intermedias (0.38 - 0.65) ---
  { text: 'traducir 20 resumenes de articulos cientificos del ingles al español y normalizar toda la bibliografia en apa 7', domain: 'general_qa', complexity: 0.48 },
  { text: 'explicar las diferencias entre procesos e hilos en sistemas operativos con cuadro comparativo detallado', domain: 'general_qa', complexity: 0.46 },
  { text: 'comparar las normas apa 7 ieee y vancouver para citacion de fuentes academicas en ingenieria y medicina', domain: 'general_qa', complexity: 0.50 },
  { text: 'organizar un cronograma de estudio de 8 semanas con entregables e hitos para preparar examenes finales', domain: 'general_qa', complexity: 0.42 },
  { text: 'explicar el funcionamiento macroeconomico de la inflacion tasas de interes del banco de la republica y tipo de cambio', domain: 'general_qa', complexity: 0.58 },
  { text: 'elaborar cuadro comparativo de las ramas del poder publico en colombia y sus funciones constitucionales', domain: 'general_qa', complexity: 0.47 },
  { text: 'traducir abstract academico del español al ingles britanico formal y validar terminologia tecnica', domain: 'general_qa', complexity: 0.45 },
  { text: 'explicar las etapas del metodo cientifico con ejemplos aplicados a ciencias sociales y salud publica', domain: 'general_qa', complexity: 0.49 },

  // --- Avanzadas y Frontera (0.74 - 0.95) ---
  { text: 'sintetizar epistemologia comparada multidisciplinaria con critica metodologica exhaustiva de nivel doctoral', domain: 'general_qa', complexity: 0.93 },
  { text: 'evaluar implicaciones bioeticas regulatorias y juridicas de la edicion genetica crispr en derecho internacional comparado', domain: 'general_qa', complexity: 0.84 },
  { text: 'realizar analisis geopolitico y macroeconomico multivariable sobre cadenas de suministro de semiconductores y comercio global', domain: 'general_qa', complexity: 0.81 },
  { text: 'analizar comparativamente los marcos constitucionales y jurisprudenciales de proteccion de datos en union europea y latinoamerica', domain: 'general_qa', complexity: 0.82 },
  { text: 'evaluar teorias epistemologicas contemporaneas de popper kuhn y lakatos aplicadas a la validacion de modelos cientificos', domain: 'general_qa', complexity: 0.85 },
  { text: 'sintetizar impactos macroeconomicos fiscales y regulatorios de tratados de libre comercio e integracion financiera regional', domain: 'general_qa', complexity: 0.80 },
];

/**
 * Divide de forma determinista y estratificada por dominio y nivel de complejidad:
 * - 80 % para Entrenamiento (TRAINING_SAMPLES)
 * - 20 % para Validación / Test nunca visto (VALIDATION_SAMPLES)
 */
function buildStratifiedSplit(samples) {
  const train = [];
  const validation = [];
  const byDomain = new Map();

  for (const item of samples) {
    const list = byDomain.get(item.domain) || [];
    list.push(item);
    byDomain.set(item.domain, list);
  }

  for (const list of byDomain.values()) {
    // Ordenar por complejidad para que tanto train como validation cubran todo el espectro (básico, medio, avanzado)
    const sorted = [...list].sort((a, b) => a.complexity - b.complexity);
    sorted.forEach((sample, idx) => {
      // Cada 5to elemento (20%) va al conjunto de validación independiente
      if (idx % 5 === 2) {
        validation.push(sample);
      } else {
        train.push(sample);
      }
    });
  }

  return { train, validation };
}

const split = buildStratifiedSplit(ALL_LABELED_SAMPLES);

export const TRAINING_SAMPLES = split.train;
export const VALIDATION_SAMPLES = split.validation;
