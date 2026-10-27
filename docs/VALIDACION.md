# Verificación de la segunda versión

## Corrección de superficie y colores

La revisión posterior corrigió la contaminación verde de la capa térmica: el shader mezclaba un 24 % de textura geográfica y un 26 % adicional de relleno al seleccionar un territorio. Ahora los colores térmicos se conservan, la selección usa únicamente un contorno y solo el valor ausente original se dibuja en gris claro neutro. Se añadió esa categoría a la leyenda.

El campo de altura se suaviza independientemente de los valores medidos y se comprime de forma continua. La malla usa cinco vértices y cuatro triángulos por celda para conservar el color original en el centro y unir los bordes. Una cota geométrica demuestra que todas las facetas, también durante transiciones y con intensidad de 0 a 200 %, permanecen fuera de la esfera interior.

Pasaron las 17 pruebas y la compilación. Las siete regresiones nuevas comprueban la conservación del extremo ártico de enero de 1933 (+13,14 °C), las 900 celdas válidas al sur de 80° S en septiembre de 2026, los ceros válidos, las ausencias reales de enero de 1926, las costuras de longitud y polos, los radios seguros y el suavizado de saltos entre vecinos. Se inspeccionó en navegador la Antártida con relieve al 200 %, sin errores de shader.

Revisión técnica del 26 de octubre de 2026. No sustituye pruebas con participantes ni la coevaluación del grupo.

## Pruebas y datos

`npm test`: diez pruebas de cálculo aprobadas, además de los verificadores de datos y áreas.

- Referencias globales y ubicación de los umbrales de París.
- Comparación de ventanas iguales, sin superposición, mínimo de 24 meses y al menos el 50 % de registros válidos por ventana.
- Valores ausentes, promedio móvil y límites de la paleta.
- Promedios regionales ponderados por área, cobertura y rechazo de medias con menos del 50 % del área disponible.
- Selección de polígonos con agujeros y multipolígonos.
- Sectores de 2° y 6° y cruce del antimeridiano sin seleccionar accidentalmente todo el planeta.
- 1.761 meses globales continuos y 1.209 mapas mensuales desde enero de 1926.
- Rejilla nativa de 90 × 180 = 16.200 celdas por mapa, sin la reducción anterior a 6°.
- Binario nativo de 39.171.600 bytes, con 1.033.614 valores ausentes preservados.
- Gzip de 18.024.273 bytes: contenido idéntico al binario original mediante longitud y SHA-256; reducción del 53,99 % en transferencia.
- 242 países y territorios y siete continentes: pesos positivos, intersecciones parciales, conservación de áreas, microestados e índices de malla.
- Selección de 242 puntos interiores de las geometrías originales comprobada por el revisor de datos. Natural Earth es una cartografía generalizada y sus límites de microestados no coinciden necesariamente con cada coordenada urbana real.

La referencia global de 1880–1900 sigue calculada con 252 meses: −0,21785714285714286 °C en la escala NASA de 1951–1980.

## Contraste regional independiente

Se recalculó Colombia desde el NetCDF original de NASA, sin usar la función JavaScript de la aplicación. Los 43 pesos de intersección suman 1.139.431,7085 km² aproximados según esta cartografía.

| Mes | Resultado independiente | Interfaz | Cobertura |
| --- | --- | --- | --- |
| Enero de 1980 | +0,5503609915 °C | +0,55 °C | 100 % |
| Septiembre de 2026 | +2,0121102122 °C | +2,01 °C | 100 % |

Estas son estimaciones regionales ponderadas de la aplicación, no índices nacionales oficiales.

## Navegador y compilación

`npm run build` finalizó correctamente. Se abrió la compilación de producción y se observaron el relieve, las costas, las transiciones y el resaltado de Colombia. Se corrigió un error inicial del shader de líneas y se verificó la versión corregida. No se observaron errores o advertencias de recursos del origen de producción en la consola durante la revisión final.

Se revisaron las vistas de computador y los tamaños emulados de 768 × 1024 y 390 × 844 píxeles. La inspección del documento no detectó desbordamiento horizontal. No son pruebas en teléfonos o tabletas físicos. En móvil, el período queda plegado inicialmente para facilitar el acceso al globo.

Se comprobó mediante la interfaz:

- Búsqueda de Colombia y actualización del contorno, enfoque, indicadores, gráfica histórica y barras del año.
- Cambio de mes exacto a enero de 1980 y sincronización de los valores y del mapa.
- Selección por teclado de un sector de 6° frente a la cámara, con su propia serie temporal.
- Selección de Antártida en enero de 1926: la cobertura insuficiente conserva el porcentaje y presenta el promedio como no disponible; no aparecen líneas de París para regiones.
- Cambio de lugar con una fecha fuera de cobertura: se recupera el último período válido y los datos corresponden al nuevo lugar, sin mezclar estados.
- Clic en la gráfica histórica: el marcador, la fecha, el mapa y la sección del momento seleccionado se sincronizan.
- Reproducción a cinco meses por segundo y activación/desactivación del audio del ámbito elegido.
- Exportación CSV regional de Colombia con anomalía local, referencia seleccionada, cobertura y serie mundial original.
- Controles del mapa situados a la derecha, filtros a la izquierda y resultados/gráficas debajo en la vista de computador.

## Límites y trabajo del grupo

El suavizado NASA de 1.200 km y la malla nominal de 2° no permiten describir una ciudad como si existiera una estación local. Las fronteras de referencia se aplican a todo el período. Los criterios del 50 % son reglas explícitas de calidad de la aplicación y no umbrales oficiales de NASA. Entre 50 % y 80 % de cobertura regional se muestra un aviso.

La alternativa sin WebGL está implementada, pero no se forzó su desactivación en esta revisión. Los gestos en dispositivos físicos, las pruebas con ciudadanos, los datos del grupo y su coevaluación deben completarse con evidencias reales. No se ejecutaron publicaciones o cambios remotos en GitHub; se mantiene el flujo de publicación preparado.
