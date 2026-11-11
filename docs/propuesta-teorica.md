# Propuesta del sistema multimedia Termómetro de la Tierra
Arquitectura de Sistemas Multimedia
Versión para revisión académica del 26 de octubre de 2026

## Propósito y resultado esperado
Termómetro de la Tierra es una aplicación web para explorar cómo cambian las anomalías de temperatura superficial desde enero de 1926 hasta el último mes disponible en NASA GISTEMP. Integra un globo tridimensional con relieve de datos, gráficas mensuales y sonido opcional. Permite consultar el mundo, países y territorios, continentes y sectores geográficos elegidos. Su propósito es convertir una serie climática extensa en una experiencia comprensible y verificable.

La pregunta principal es cuánto ha cambiado la anomalía media de un lugar entre dos ventanas de un período elegido. El usuario puede seleccionar fechas vinculadas con su propia vida y recorrer cada mes sobre la gráfica. La vista mundial permite relacionar la evolución con las referencias de +1,5 °C y +2,0 °C de París, usando la aproximación histórica solicitada por el taller. Estas líneas no se aplican a las vistas regionales.

## Alcance de la entrega
El prototipo utiliza datos publicados y comunica las referencias y limitaciones de las cifras. La malla conserva las celdas originales de 2° × 2° de NASA. Las series regionales son cálculos propios ponderados por superficie; no se presentan como índices nacionales oficiales. El relieve es una metáfora de la anomalía, no una elevación real. La información espacial no se inventa a partir de la media global.

La copia de datos preparada el 26 de octubre de 2026 comprende enero de 1880 a septiembre de 2026. El intervalo de exploración contiene 1209 meses desde enero de 1926. La aplicación se desarrolla en la carpeta del proyecto y puede compilarse para alojamiento web estático. La publicación en Internet y las pruebas con participantes deben documentarse con evidencias cuando se realicen. Esta propuesta no afirma que exista una URL pública ni que se hayan ejecutado pruebas de usuario.

## Datos académicos por completar
| Campo | Información |
| --- | --- |
| Institución y programa | Por completar por el equipo |
| Asignatura y docente | Arquitectura de Sistemas Multimedia / por completar |
| Integrantes y códigos | Por completar por el equipo |
| Grupo y fecha de entrega | Por completar según el curso |

La descripción suministrada asigna 50 % a la propuesta teórica y 50 % al prototipo; la valoración individual incorpora la evaluación entre compañeros. Los registros de contribución y el formato de coevaluación se incluyen al final para que el equipo los complete con su trabajo real.
# Fundamento e interpretación de los datos
## Problema y objetivos
La dificultad de comunicación consiste en relacionar variaciones mensuales, diferencias geográficas y cambio a largo plazo sin confundir clima con el tiempo meteorológico de una ciudad. El objetivo es facilitar esa lectura mediante una representación multimedia que mantenga visible la procedencia de los datos y permita elegir el lugar observado.

Los objetivos específicos son explorar desde 1926, seleccionar un ámbito geográfico, identificar la referencia de cada anomalía, comparar ventanas equivalentes e interpretar las referencias globales de París. El color, el relieve y el sonido apoyan la lectura. La información esencial permanece disponible también sin escuchar audio ni manipular el globo.

## Anomalías y referencia histórica
NASA GISTEMP v4 publica anomalías respecto a 1951–1980, no temperaturas absolutas. Una anomalía de +1 °C expresa una diferencia respecto al valor de referencia correspondiente; no significa que la superficie terrestre esté a 1 °C. La documentación de NASA explica esta distinción [1, 2].

Sea A(t) la anomalía mensual global NASA. Se calcula b como el promedio de todos los meses válidos de enero de 1880 a diciembre de 1900, ambos inclusive. La escala histórica del taller es H(t) = A(t) − b. Se conserva la serie anterior a 1926 únicamente para calcular b, sin mostrarla como parte del rango de exploración.

En la copia preparada, b = −0,217857142857 °C, con 252 meses válidos. Esta aproximación cumple el taller; no sustituye una reconstrucción de 1850–1900. Solo la serie y las estadísticas mundiales alternan entre la escala NASA y la histórica. Al cambiar de referencia se desplazan datos y líneas de París sin modificar la diferencia entre períodos. En escala NASA las líneas corresponden a 1,5 + b y 2,0 + b. El globo y las series de países, continentes y sectores mantienen la referencia local NASA 1951–1980.

## Comparación entre ventanas
El usuario escoge ventanas de 1, 5 o 10 años; el valor inicial es 10. Para un rango con N meses, se usa w = mínimo(12 × años elegidos, parte entera de N/2). Se comparan los primeros w meses y los últimos w meses. Las ventanas tienen la misma duración y no se superponen. Cada una debe abarcar al menos 12 meses; si el rango contiene menos de 24, se informa que el período es insuficiente y no se calcula una diferencia.

La diferencia es Δ = media final − media inicial, con fechas y número de observaciones visibles. Cada ventana necesita al menos el 50 % de sus observaciones mensuales válidas; si no alcanza ese mínimo, su media y la diferencia se muestran como datos insuficientes, conservando fechas y recuentos. Es un criterio de la aplicación. Las ausencias no son cero. Las ventanas cortas son exploratorias y no equivalen a climatologías de varias décadas.

El Acuerdo de París persigue limitar el aumento global a largo plazo [3]. Que un mes o un promedio corto sobrepase una línea no demuestra por sí mismo un incumplimiento permanente. Esta advertencia acompaña la visualización.
# Usuarios y diseño de la experiencia
## Público y contexto de uso
El público principal son ciudadanos y estudiantes que pueden no tener formación en climatología. Se consideran consultas breves desde teléfonos, exploraciones en clase con computador y uso desde tabletas. El diseño evita exigir una cuenta, conocimientos estadísticos o instalación para consultar la versión publicada.

Se proponen tres perfiles de evaluación: una persona que desea explorar los años de su vida, un estudiante que debe explicar la diferencia entre anomalía y temperatura y un docente que quiere comparar dos períodos de manera reproducible. Son perfiles de diseño, no personas entrevistadas ni resultados de investigación.

## Recorrido principal
1. Al abrir la aplicación, encuentra el propósito, la fuente y una invitación clara para explorar el clima.
2. Elige el mundo, un país o territorio, un continente o un sector geográfico. Para un sector selecciona un tamaño de 2°, 6° o 10° y hace clic sobre el globo.
3. Observa la anomalía del mes y la gráfica específica del ámbito elegido; una leyenda explica color, relieve, referencia y cobertura.
4. Ajusta inicio y fin del rango. Recorre la línea de tiempo o reproduce los meses: un marcador muestra dónde se encuentra dentro de la gráfica.
5. Consulta el promedio del período y la comparación entre ventanas de los extremos, con advertencias cuando no hay duración o cobertura suficiente.
6. Activa o silencia el sonido, ajusta el relieve y consulta la metodología cuando lo necesite. Los controles detallados no desplazan la lectura principal.

## Jerarquía y lenguaje visual
El diseño adopta una lectura editorial inspirada en Greenpeace España [11]: blanco, títulos grandes, texto negro y verde #2ab20b. Mantiene una identidad propia, sin copiar logotipo, fotografías ni textos. Los filtros de lugar y fechas se sitúan junto al globo. Referencia y ventanas quedan en opciones avanzadas; las gráficas y resultados se leen debajo. Una barra de herramientas reúne vista, rotación, sonido y relieve.

Los valores negativos y positivos utilizan una escala divergente con una leyenda numérica. El centro de cada celda conserva el color de su anomalía original, sin mezclas de mapas ni rellenos verdes de selección. El relieve destaca patrones cálidos mediante un suavizado solo visual y una altura limitada. El control de intensidad cambia esa exageración artística sin modificar los datos; signos y texto complementan el color.

## Accesibilidad y adaptación
Los controles cuentan con etiquetas en español, foco visible y uso por teclado. El diseño se reorganiza en una columna cuando el ancho disminuye. Los estados de reproducción y sonido se expresan mediante texto; ningún resultado esencial depende exclusivamente de un color, gesto, animación o sonido.

Se respeta la preferencia de movimiento reducido y se ofrece pausa. Si WebGL no está disponible, se comunica la limitación y se conserva el acceso a la serie y los resultados numéricos. El audio comienza desactivado y su activación requiere una acción del usuario. El objetivo es una interacción usable; una declaración formal de conformidad de accesibilidad requeriría una auditoría específica.
# Requisitos y criterios de aceptación
La siguiente matriz traduce la descripción del taller en comportamientos verificables. El resultado de cada comprobación debe registrarse con su fecha, dispositivo y evidencia; la tabla define criterios, no certifica pruebas realizadas.

| ID | Requisito | Criterio observable |
| --- | --- | --- |
| R1 | Serie global mensual real | Hay meses desde enero de 1926 hasta el corte descargado; fuente y fecha son consultables. |
| R2 | Selección de rango | Inicio y fin se editan; se impide un rango invertido o fuera de cobertura. |
| R3 | Comparación de promedios | Ventanas sin superposición con fechas y recuentos; cada media exige al menos 50 % de meses válidos; no se comparan meses aislados. |
| R4 | Referencias coherentes | La base 1880–1900 se calcula con meses válidos; el cambio de escala desplaza también las referencias de París. |
| R5 | Globo con datos espaciales | El mes controla una malla NASA real; color y altura representan anomalías; las ausencias son distinguibles. |
| R6 | Exploración temporal | Reproducción, pausa y navegación mantienen mes y vistas sincronizados. |
| R7 | Señales sonoras | El usuario activa y silencia el audio; el cambio térmico modifica perceptiblemente el tono. |
| R8 | Interpretación explícita | Se explica anomalía, referencia, relieve artístico y alcance de las líneas de París. |
| R9 | Acceso multidispositivo | Controles y resultados siguen siendo utilizables en móvil, tableta y computador. |
| R10 | Recursos permitidos | Datos, bibliotecas y recursos propios tienen procedencia y condiciones de uso documentadas. |
| R11 | Reproducibilidad | Hay instrucciones de instalación, compilación y actualización; los datos incluyen metadatos. |
| R12 | Entrega académica | Se aporta propuesta completa, prototipo y formato para registrar contribuciones y coevaluación. |
| R13 | Selección geográfica | El ámbito elegido actualiza su serie y cobertura; con menos de 50 % de área disponible no se muestra una media regional. |
| R14 | Momento mensual en gráfica | Un marcador visible y una etiqueta de fecha acompañan el mes recorrido o reproducido. |

## Restricciones de implementación
Se emplean herramientas gratuitas y recursos propios o con condiciones compatibles con la entrega. Los archivos climáticos se preparan antes de abrir la aplicación para evitar que el navegador descargue un archivo científico completo o dependa de permisos de acceso cruzado de NASA.

El prototipo no ofrece predicciones climáticas, atribución causal por ciudad, alertas meteorológicas ni análisis de riesgo individual. Cuando una funcionalidad depende de una capacidad del dispositivo, se informa de su disponibilidad sin ocultar los resultados principales.
# Arquitectura y tratamiento de la información
## Componentes del sistema
La aplicación utiliza HTML, CSS y JavaScript con Vite para desarrollo y compilación, Three.js para la escena WebGL y Web Audio para la sonificación. Datos, ámbito geográfico y vistas comparten un estado temporal. El alojamiento sirve archivos estáticos; no se necesita una base de datos con usuarios.

El flujo es: archivos NASA y geometrías Natural Earth → preparación de datos y pesos → serie mundial y malla mensual con metadatos → selección de lugar, período y referencia → globo, gráfica, métricas y sonido. La preparación conserva el origen científico y permite actualizar datos sin rediseñar la interfaz.

## Serie global
La serie mensual conserva año, mes y anomalía en grados Celsius. Se validan encabezados, orden cronológico, duplicados, ausencias y cobertura. Los indicadores globales proceden de la tabla global NASA: no se recalculan como el promedio simple de celdas del globo, porque ese promedio no reproduce necesariamente el método del índice [2].

La preparación calcula b a partir de 1880–1900 y registra la cantidad de meses usados. También conserva la URL de origen y la fecha de consulta. Los meses posteriores al último dato publicado permanecen fuera de la selección; la fecha del computador no se usa para inventar datos.

## Campo espacial y rendimiento
El globo recibe mapas mensuales GISTEMP LOTI con suavizado de 1200 km [6, 7]. Conserva la malla original de 2° × 2°: 90 filas y 180 columnas, 16200 celdas por mes. No se agrega a una resolución más gruesa. Los valores ausentes conservan su marcador y no se rellenan con distribuciones inventadas. Una malla más fina mejora el dibujo y la selección, pero el suavizado científico limita la independencia y el detalle local de sus valores.

Los datos numéricos compactos y la reutilización de geometrías reducen el trabajo por cuadro. Se ajusta la resolución de renderizado para pantallas de alta densidad y se evita reconstruir la escena completa al mover un control. El límite práctico de rendimiento debe medirse en los dispositivos de prueba; esta propuesta no fija resultados que aún no se han medido.

## Coherencia de la referencia espacial
Las anomalías locales NASA se refieren a su climatología 1951–1980. El globo y las series regionales mantienen esta referencia: el selector modifica solamente la serie y las estadísticas mundiales. No se resta b a cada región, porque ese desplazamiento no estima una climatología preindustrial de cada lugar. Las leyendas identifican las referencias para evitar comparar escalas distintas sin advertirlo.

La cobertura temprana, la resolución y la exageración de altura limitan la lectura espacial. El globo muestra patrones y apoya la exploración; la cifra mundial oficial y las comparaciones temporales permanecen disponibles por separado.
# Selección geográfica y lectura de las gráficas
## Cálculo por país continente o sector
Para un país o territorio, el peso de una celda es el área de intersección entre su polígono y la celda NASA. Los polígonos proceden de Natural Earth a escala 1:50 millones [10]. Los bordes se densifican a 0,2° y se calculan intersecciones en coordenadas equivalentes x = longitud en radianes, y = seno de latitud. El resultado aproxima áreas esféricas; no certifica superficies territoriales oficiales.

Sea q(i) el área de intersección de cada celda y V(t) el conjunto de celdas con dato válido en el mes t. La anomalía regional candidata es R(t) = suma de q(i) × A(i,t) en V(t), dividida por la suma de q(i) en V(t). La cobertura es C(t) = suma de áreas válidas / suma de áreas seleccionadas, expresada en porcentaje. Solo se publica la media cuando C(t) es al menos 50 %; si es menor, se conserva la cobertura y se indica que los datos son insuficientes.

Las siete regiones continentales reúnen las superficies terrestres de países y territorios clasificados en cada continente. Un sector es un rectángulo geográfico de tamaño nominal 2°, 6° o 10°, con hasta 1, 9 o 25 celdas respectivamente; junto a los polos se recorta al límite de latitud. Se centra en la celda elegida y puede incluir tierra y mar. La selección muestra qué ámbito se promedia: país costero y sector próximo pueden dar resultados distintos.

## Cobertura y límites de interpretación
Con cobertura de 50 % a menos de 80 % se muestra la media con una advertencia de cobertura reducida. Por debajo de 50 % no se publica una media potencialmente poco representativa; el porcentaje permanece visible y la gráfica deja el mes sin valor. Son criterios de calidad de la aplicación, no umbrales impuestos por NASA. Los cambios de cobertura pueden afectar la comparación entre períodos.

Los mismos polígonos geográficos se aplican a toda la historia: la serie no reconstruye cambios de fronteras. Una celda comparte un valor dentro de sus límites y el producto tiene suavizado de 1200 km [7]. Por ello, un país pequeño puede compartir información climática con lugares vecinos. Las series son estimaciones propias a partir de la malla, no mediciones de cada ciudad ni índices nacionales oficiales.

## Vistas temporales coordinadas
La gráfica principal muestra los meses, una media móvil de 12 meses y el marcador del momento activo. En una vista regional se puede contrastar la serie con la mundial usando ambas en referencia NASA 1951–1980. Un detalle del año activo presenta sus 12 meses como barras y resalta el mes elegido; los meses sin datos no reciben valores inventados.

Los resultados resumen el mes, la cobertura, el promedio del período y la diferencia entre ventanas. El máximo o el mayor salto entre meses son descripciones de la serie seleccionada, no tendencias climáticas por sí solos. Las líneas de París aparecen únicamente en la gráfica mundial. La atribución del calentamiento global a emisiones humanas se apoya en evidencia científica externa [8, 9]; una secuencia mensual local no permite identificar por sí sola las causas de sus variaciones.
# Integración artística y sonora
## Visualización del globo
La propuesta artística convierte los patrones térmicos en una superficie suave sobre el planeta. Cada celda mantiene en su centro el color calculado con la anomalía NASA original; los bordes interpolan el color para conectar las celdas. La paleta térmica se aplica sin tintes de atlas ni rellenos de selección que tapen los datos. La selección se identifica mediante un contorno y el valor numérico original de cada centro sigue disponible.

Para la altura se aplican varias pasadas gaussianas de 5 × 5 celdas y se construye una superficie continua; la compresión gradual evita picos bruscos. Al 100 %, la elevación se limita al 3,6 % del radio del globo y permanece sobre su superficie base. Este tratamiento afecta solo la geometría dibujada: no sustituye las anomalías originales ni cambia colores centrales, estadísticas, gráficas o sonido. La leyenda explica que el relieve es artístico y la escala se conserva entre meses.

La rotación y el acercamiento permiten inspeccionar regiones. La pausa de rotación y el restablecimiento de la vista ayudan a recuperar orientación. Únicamente las celdas realmente sin dato aparecen en gris claro neutro #aeb8bd; no se confunden con una anomalía de cero ni reciben un relleno verde al seleccionarlas.

## Sonificación
El navegador genera sonidos propios con osciladores de Web Audio. La anomalía del mes en el ámbito elegido controla una frecuencia que aumenta dentro de un intervalo acotado; el volumen varía moderadamente y con transiciones suaves. El mapeo sonoro se limita a −1 a +3 °C: valores regionales fuera de ese intervalo saturan la nota, pero conservan su cifra real en pantalla. La sonificación no distingue todos los extremos regionales.

La nota y el mes se actualizan desde el mismo estado temporal que las gráficas y el marcador mensual. El sonido requiere activación y puede silenciarse en cualquier momento. La pausa detiene la secuencia; al reanudar no suenan meses acumulados. La lectura mundial sigue su escala elegida; el mapa y las lecturas regionales conservan la base NASA. La ausencia de datos no se sonifica como anomalía cero.

La sonificación es una codificación diseñada para apoyar la exploración, no una alarma ni un sonido emitido por la Tierra. Su leyenda explica la relación entre tono y anomalía. El valor numérico y el gráfico expresan la misma información para las personas que no oyen o prefieren mantener silencio.

## Recursos y condiciones de uso
El código, el diseño y los sonidos creados para el proyecto son recursos propios. Three.js y Vite usan licencia MIT y se conservan sus avisos. Natural Earth ofrece sus datos en dominio público [10]: se registran la escala, el archivo y la procedencia de costas y países. Las fuentes del sistema evitan descargas adicionales. Greenpeace es una referencia visual, no proveedor de datos ni patrocinador de la aplicación.

NASA debe acreditarse como fuente de los datos, sin afirmar que respalda o certifica la aplicación. No se necesita incorporar su logotipo. La entrega incluye la referencia a GISTEMP y al estudio metodológico que NASA solicita citar [1, 4].
# Plan de validación y evaluación
## Comprobaciones técnicas y científicas
Antes de entregar, se propone contrastar varios meses de la serie con la tabla oficial, verificar de forma independiente el promedio b, revisar el primer y último mes y comprobar que cambiar la base no modifica Δ. Se revisan un rango largo, uno menor de dos ventanas solicitadas, un rango de dos meses y uno de un solo mes.

Se verifican latitudes, longitudes, escala binaria y sincronía entre gráfica, barras, mapa y marcador. Se contrastan celdas y pesos fronterizos; se prueban islas, países pequeños, continentes y sectores polares o que crucen 180°. Se revisan los límites de cobertura 50 % y 80 % y ventanas con menos de la mitad de meses válidos: deben conservar cobertura y recuentos, sin inventar medias ni convertir ausencias en cero.

En la interfaz se revisan teclado, foco, etiquetas, reducción de movimiento, controles táctiles, silencio inicial, pausa y reanudación. La compilación de producción debe finalizar sin errores. Se registran consola, carga inicial y respuesta de los controles en una pantalla móvil, una tableta y un computador. La ausencia de WebGL debe dejar un mensaje comprensible y resultados numéricos accesibles.

## Prueba con participantes por realizar
Se propone una sesión moderada con entre 5 y 8 personas de experiencia digital variada, sin afirmar que esta muestra se haya reclutado. Se solicita consentimiento, no se recogen datos sensibles y se identifican los registros mediante códigos. Se explica que se evalúa el producto y no los conocimientos de la persona.

Las tareas son elegir país y sector, encontrar un rango, explicar +1 °C y el porcentaje de cobertura, mover el mes y localizarlo en ambas gráficas, comparar ventanas y silenciar el audio. También se pide explicar por qué las líneas de París aparecen solo en la vista mundial. Se registra éxito, ayuda requerida y comentarios; se revisa si el relieve se confunde con topografía o la malla con precisión urbana.

## Criterios para iterar
Se propone que al menos 80 % complete sin ayuda las tareas básicas y que ninguna persona termine creyendo que la anomalía es temperatura absoluta o que un mes aislado certifica un incumplimiento de París. Estos son objetivos de evaluación, no resultados obtenidos. Una interpretación errónea requiere corregir etiquetas y explicaciones antes de agregar efectos visuales.

| Registro de evidencia | Información que debe completarse |
| --- | --- |
| Prueba y versión | Identificador de prueba y revisión del código |
| Entorno | Navegador, dispositivo, tamaño de pantalla y fecha |
| Resultado | Esperado, observado y estado aprobado o pendiente |
| Evidencia | Captura, cálculo contrastado o registro de consola |
| Acción | Defecto, responsable y verificación tras corregir |

El informe final de validación debe separar las pruebas automatizadas y técnicas realmente ejecutadas de las sesiones con usuarios y las comprobaciones todavía pendientes.
# Metodología y organización del equipo
## Fases de desarrollo multimedia
Análisis. Se identifican audiencia, contexto, objetivos de aprendizaje, alcance del taller y fuentes. El entregable es una lista de requisitos trazable, acompañada de las reglas de interpretación de datos y las restricciones de recursos.

Diseño. Se define la navegación, la jerarquía visual, las escalas, el tratamiento de ausencias, las ventanas de comparación y la relación sonora. El entregable incluye el recorrido principal, bocetos de pantalla y el contrato entre los módulos de datos y de presentación.

Producción. Se prepara una copia reproducible de los datos, se implementan las vistas y controles y se integran las señales sonoras. Cada contribución se revisa y se prueba antes de combinarse. Se conservan referencias, licencias y decisiones técnicas junto al proyecto.

Evaluación e iteración. Se contrastan los cálculos, se ejecuta el plan de pruebas técnicas y se realizan las sesiones de comprensión. Los hallazgos se priorizan según su impacto sobre exactitud, acceso y uso. Los entregables son evidencias y una lista de cambios verificables.

Entrega. Se compila el sitio, se publica cuando corresponda y se comprueba la URL desde una conexión externa. Se entrega la propuesta, el código, los datos preparados, las instrucciones y los registros reales del trabajo. Las fases se pueden repetir al encontrar problemas; no se presentan como actividades ya realizadas.

## Responsabilidades por asignar
| Área | Responsable | Evidencia sugerida |
| --- | --- | --- |
| Análisis y redacción | Por completar | Requisitos, revisiones y fuentes |
| Datos y cálculos | Por completar | Script, metadatos y contrastes |
| Interfaz y globo | Por completar | Cambios, capturas y pruebas |
| Sonido y accesibilidad | Por completar | Implementación y lista de revisión |
| Pruebas y publicación | Por completar | Registros, correcciones y URL |

## Formato de coevaluación por completar
Cada integrante evalúa a los demás con la escala acordada por el docente. Se registran nombre de evaluador, persona evaluada, fecha, nota en la escala oficial y justificación basada en contribuciones observables. El promedio para una persona se calcula con las notas que le asignen sus compañeros, sin incluir una autoevaluación, según la descripción del taller.

Registro: evaluador __________; evaluado __________; nota __________; escala __________; contribuciones verificadas __________; observaciones __________. La autoevaluación puede añadirse como reflexión separada. No se inventan notas ni se presenta una fórmula adicional de ponderación individual sin confirmarla con el docente.
# Uso publicación y referencias
## Guía de uso y entrega
Se eligen lugar e intervalo, se recorre el mes en el globo y las gráficas y se consultan los promedios. París y la referencia histórica aproximada se reservan al mundo; regiones y sectores usan NASA 1951–1980. Las capturas de una exposición deben conservar ámbito, referencia, fecha y cobertura.

Para ejecutar se instala Node compatible con package.json, se usa npm install y npm run dev desde el proyecto. npm run build genera dist y npm run preview permite revisar la compilación. El README contiene las instrucciones operativas que prevalecen si se actualiza el empaquetado.

Para ofrecer acceso por Internet se publica dist en un alojamiento estático con HTTPS y se comprueba la URL desde otra red y un teléfono. La entrega registra URL, fecha, versión y limitaciones; una captura en localhost no acredita publicación. Las actualizaciones de NASA se incorporan mediante el script de preparación.

## Limitaciones y mantenimiento
La copia tiene un corte temporal y puede cambiar cuando NASA revise meses anteriores. La referencia 1880–1900 es aproximada y el relieve artístico. Cobertura, suavizado y resolución limitan la lectura regional. No se presenta una banda de incertidumbre cuantificada sin incorporar su conjunto de datos.

Cada actualización revisa formato, cobertura, ausencias, pesos, promedio histórico y sincronía de vistas. Se conserva la procedencia y se repiten las comprobaciones afectadas. Para la evaluación final se completan datos del grupo, evidencias de pruebas y coevaluación.

## Referencias consultadas el 26 de octubre de 2026
[1] GISTEMP Team. 2026. GISS Surface Temperature Analysis, version 4. NASA GISS. https://data.giss.nasa.gov/gistemp/

[2] NASA GISS. GISTEMP Frequently Asked Questions. https://data.giss.nasa.gov/gistemp/faq/

[3] UNFCCC. The Paris Agreement. https://unfccc.int/process-and-meetings/the-paris-agreement

[4] Lenssen, N., et al. 2024. A GISTEMPv4 observational uncertainty ensemble. JGR Atmospheres, 129, e2023JD040179. https://doi.org/10.1029/2023JD040179

[5] Descripción del taller. Termómetro de la Tierra. Arquitectura de Sistemas Multimedia. Archivo 1. ASM - Proyecto 3.3 - Descripción.docx.

[6] NASA GISS. GISTEMP v4 Data Downloads. https://data.giss.nasa.gov/gistemp/data_v4.html

[7] NASA GISS. Global Maps. https://data.giss.nasa.gov/gistemp/maps/

[8] NASA Science. What Is Climate Change. https://science.nasa.gov/climate-change/what-is-climate-change/

[9] NASA Science. Causes. https://science.nasa.gov/climate-change/causes/

[10] Natural Earth. Terms of Use. Datos geográficos en dominio público. https://www.naturalearthdata.com/about/terms-of-use/

[11] Greenpeace España. Cambio climático. Referencia visual. https://es.greenpeace.org/es/trabajamos-en/cambio-climatico/
