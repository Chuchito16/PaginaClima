# Termómetro de la Tierra

Sistema multimedia para el taller de Arquitectura de Sistemas Multimedia. Datos mensuales reales de NASA GISTEMP v4 desde enero de 1926 hasta septiembre de 2026, globo 3D con relieve térmico y sonificación original.

## Iniciar

Requiere Node.js 22.12 o superior. En Windows abre **Iniciar-Clima.cmd**, o ejecuta:

```powershell
npm install
npm run dev
```

Abre la dirección de Vite, normalmente http://127.0.0.1:5173/. Se necesita Internet para la primera instalación; todos los recursos y datos se sirven localmente después. No abras `index.html` con doble clic: los módulos y las peticiones de datos necesitan un servidor HTTP.

## Funciones

- Globo Three.js con 16.200 celdas nativas de 2°, nueve veces más que la primera versión. Costa de Natural Earth a escala 1:50 millones y superficie continua con transiciones de color, relieve e iluminación en GPU. Las celdas cálidas se elevan más; la altura no representa topografía.
- Mapas mensuales reales de NASA sin reducción espacial. Se conservan los valores ausentes y se mantienen los datos medidos para cálculos y consultas, separados del suavizado visual.
- Buscador de 242 países y territorios, siete regiones continentales y sectores geográficos de 2°, 6° y 10° seleccionables con clic, toque o teclado. Los sectores se recortan en los polos; pueden cruzar el antimeridiano.
- Series propias de cada lugar, ponderadas por el área real de intersección con las celdas NASA. Contorno resaltado y enfoque animado en la selección.
- Período mensual, atajos de todo el siglo y últimos 360 meses, reproducción de 2, 5 o 10 meses por segundo.
- Gráfica histórica mensual, promedio móvil de 12 meses, comparación opcional con el mundo y doce barras del año seleccionado. Todos los indicadores y gráficas se sincronizan con el mes de la línea de tiempo.
- Información del momento elegido, cobertura del área, cambio frente al mismo mes del año anterior y promedio del año hasta ese mes. Los umbrales de París y el selector de referencia histórica solo se usan para la serie mundial.
- Comparación entre promedios iniciales y finales de 1, 5 o 10 años, sin superposición. Mínimo de 24 meses para comparar. Las ventanas se acortan por igual cuando hace falta, con aviso.
- Promedio del período, mes más cálido y descarga de CSV con valores originales y ajustados.
- Audio original Web Audio activado por el usuario, asociado a la anomalía del lugar elegido. Más calentamiento produce mayor frecuencia e intensidad, con volumen moderado. Sin reproducción automática.
- Nuevo diseño claro, con blanco, negro y verde inspirado en la referencia visual de Greenpeace: filtros a la izquierda, globo en el centro, botones del mapa a la derecha e información y gráficas debajo. Controles avanzados plegados, textos mayores y diseño adaptable.

Arrastra el globo o usa rueda/pellizco. Con el globo enfocado, las flechas giran, `+`/`-` acercan o alejan e `Inicio` restablece. `Enter` o `Espacio` seleccionan el lugar frente a la cámara. Un clic sobre tierra elige el país y sobre el océano elige un sector. En modo sector, cualquier clic selecciona un sector. Puedes escribir un mes exacto o hacer clic en las gráficas para recorrer el tiempo.

## Interpretación científica

GISTEMP comunica **anomalías**, no temperaturas absolutas. Su referencia original es 1951–1980. La media de los 252 meses de 1880–1900 es **−0,21785714285714286 °C** respecto a esa referencia.

La serie global permite restar esa media y usar 1880–1900 como aproximación preindustrial. Es distinta de 1850–1900 y no constituye una evaluación oficial de cumplimiento de París. Los umbrales se convierten al cambiar de referencia; un mes o un año por encima no demuestra haber superado un objetivo de largo plazo.

El mapa y las series regionales mantienen **siempre la referencia 1951–1980**. Restar una media global a cada región no reconstruiría sus promedios locales preindustriales. En vista mundial se usa la tabla global oficial; al elegir un lugar, los indicadores y gráficas usan su propia serie regional. Los umbrales de París no se aplican a países ni sectores.

La malla nominal de 2° conserva el suavizado original de 1.200 km de NASA: no tiene precisión meteorológica de una ciudad. Las series regionales son estimaciones de esta aplicación, no índices nacionales oficiales. Se aplican las mismas fronteras de referencia a todos los años, sin reconstruir fronteras históricas.

La media regional pondera el área de intersección país–celda y solo usa observaciones disponibles. Como criterio propio de calidad, se exige al menos el 50 % del área con datos para mostrar un promedio; entre 50 % y 80 % se muestra un aviso. Los recuentos y el porcentaje de cobertura se conservan aunque no se calcule la media. Cada ventana comparativa necesita al menos el 50 % de sus meses válidos. Los cambios de cobertura pueden afectar las comparaciones. Los territorios pequeños deben buscarse en la lista: Natural Earth generaliza sus límites.

El color se satura en −3 y +5 °C y conserva la paleta original en el centro de cada celda NASA. Los bordes se interpolan para formar transiciones continuas. La superficie térmica no se mezcla con el atlas terrestre ni con un relleno de selección: los países y sectores se destacan solo con un contorno. Los datos realmente ausentes se muestran en gris claro, identificado en la leyenda.

La altura se calcula por separado: varias pasadas gaussianas de 5 × 5 celdas y compresión continua evitan escalones y picos bruscos. El relieve artístico alcanza como máximo un 3,6 % adicional del radio al 100 % de intensidad y permanece separado de la esfera interior. Este suavizado es exclusivamente visual: las anomalías, las máscaras de datos, las series, los valores consultados y el sonido conservan los registros originales. Las comparaciones indican los recuentos válidos y la media móvil exige 12 meses consecutivos válidos.

## Entregables

- `docs/propuesta-teorica.docx`: propuesta teórica editable actualizada al diseño y la exploración regional.
- `docs/propuesta-teorica.md`: propuesta en texto.
- Aplicación y datos: modelo prototipo.
- La propuesta incluye coevaluación. El grupo debe completar integrantes, roles, pruebas con personas y calificaciones reales.

## Verificar y compilar

```powershell
npm test
npm run build
npm run preview
```

Las 17 pruebas cubren referencias, umbrales, ventanas, cobertura, valores ausentes, pesos regionales, agujeros de polígonos, sectores que cruzan el antimeridiano y la continuidad de la superficie térmica. Las siete regresiones de renderizado utilizan datos NASA reales: polos, ceros válidos, conservación de colores, costuras y ausencia de intersecciones con la esfera interior. El verificador comprueba 1.761 meses globales continuos, 1.209 mapas de 16.200 celdas, tamaño binario, fechas, referencia, huellas y máscaras de los 242 países y siete continentes. La compilación genera `dist/`. El archivo espacial nativo pesa 39,17 MB; se entrega gzip de 18,02 MB, una reducción de transferencia del 53,99 %. Los navegadores con DecompressionStream lo descomprimen localmente; el binario original es la alternativa de compatibilidad. Ambos se verifican como contenido idéntico. La cartografía se descarga por separado.

## Publicar en Internet

La aplicación es estática: no requiere API key, base de datos ni servidor de pago. La publicación no se ha ejecutado desde esta entrega.

**GitHub Pages:** en el repositorio, selecciona Settings → Pages → Source → GitHub Actions. Sube los cambios a `main` o ejecuta **Publicar atlas en GitHub Pages**. El flujo instala, prueba, compila y adapta las rutas al nombre del repositorio. Usa la URL del paso de publicación. No se enviaron commits ni se cambiaron ajustes remotos automáticamente.

Configuración basada en la [guía oficial de Vite para GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages).

**Otro alojamiento estático:** publica todo el contenido de `dist/` en la raíz del sitio, incluyendo `data/` y `assets/`. Para un subdirectorio, define la base antes de compilar:

```powershell
$env:VITE_BASE_PATH = '/PaginaClima/'
npm run build
```

El servidor de desarrollo solo escucha en el propio computador. Publica la compilación de producción con HTTPS para recibir visitantes por Internet.

## Actualizar los datos

Instantánea descargada el 26 de octubre de 2026. NASA puede revisar meses anteriores. Con Python 3.10 o superior:

```powershell
py -m pip install -r scripts/requirements-data.txt
py scripts/update_nasa_data.py
py scripts/build_country_areas.py
npm test
npm run build
```

`--cache` reutiliza originales en `work/nasa/`. `public/data/README.md`, `public/data/provenance.json` y los metadatos JSON conservan fuentes, cobertura, procedimiento y SHA-256. Se incluye el CSV original.

## Estructura

```text
src/main.js             Interfaz y gráfico SVG
src/globe.js            Globo Three.js y relieve
src/globe-surface.js    Superficie continua y suavizado visual independiente
src/climate.js          Referencias y cálculos
src/regions.js          Promedios por área, selección y sectores
src/audio.js            Sonificación
src/style.css           Diseño adaptable
public/data/            NASA y procedencia
public/assets/          Costa Natural Earth
scripts/                Actualización y verificación
tests/                  Pruebas de cálculos
docs/                   Propuesta y créditos
```

## Fuentes y licencias

[NASA GISS/GISTEMP v4](https://data.giss.nasa.gov/gistemp/), consulta del 26 de octubre de 2026; [Lenssen et al. (2024)](https://doi.org/10.1029/2023JD040179). Código, iconos y sonidos propios bajo MIT; Three.js y Vite bajo MIT; Natural Earth de dominio público. Ver `docs/CREDITOS.md`.
