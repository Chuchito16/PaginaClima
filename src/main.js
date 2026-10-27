import './style.css';
import {createGlobe} from './globe.js';
import {monthKey,referenceOffset,compareWindows,summarize,rollingMean,formatTemperature,temperatureColor} from './climate.js';
import {regionalSeries,findCountry,createSector,yearDetails} from './regions.js';
import {ClimateAudio} from './audio.js';

const paths={globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',play:'<path d="m8 4 12 8-12 8Z"/>',pause:'<path d="M8 4v16M16 4v16"/>',plus:'<path d="M12 4v16M4 12h16"/>',minus:'<path d="M4 12h16"/>',reset:'<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/>',rotate:'<path d="M3 12a9 9 0 0 1 15-7l3 3M21 3v5h-5M21 12a9 9 0 0 1-15 7l-3-3M3 21v-5h5"/>',sound:'<path d="m11 4-6 5H2v6h3l6 5ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',mute:'<path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6M22 9l-6 6"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',layers:'<path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',chevron:'<path d="m7 10 5 5 5-5"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.info}</svg>`;
const $=s=>document.querySelector(s);
const fmtMonth=new Intl.DateTimeFormat('es',{month:'long',year:'numeric',timeZone:'UTC'});
const longMonth=row=>fmtMonth.format(new Date(Date.UTC(row.year,row.month-1,1))).replace(/^./,c=>c.toUpperCase());
const shortMonth=row=>`${String(row.month).padStart(2,'0')}/${row.year}`;
const percent=value=>`${Math.round((value||0)*100)} %`;
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WORLD={id:'world',name:'Todo el planeta',type:'world'};
const audio=new ClimateAudio();
let dataset,meta,gridValues,globe,areas=[],features=[],globalSeries=[],series=[],selected=[],area=WORLD,current=0,timer=null,reference='preindustrial',chartWidth=900,annualWidth=350;
const seriesCache=new Map();

$('#app').innerHTML=`
<a href="#explorar" class="skip-link">Saltar al mapa</a>
<header class="site-header"><a class="brand" href="#explorar"><span class="brand-symbol">${icon('globe')}</span><span>TERMÓMETRO<span>DE LA TIERRA</span></span></a><nav aria-label="Principal"><a class="active" href="#explorar">Explorar el clima</a><button data-dialog="about-dialog">Cómo funciona</button></nav><button class="header-source" data-dialog="sources-dialog">DATOS NASA <span>↗</span></button></header>
<main><section class="intro"><div><p class="eyebrow">EL CAMBIO CLIMÁTICO, MÁS CERCA</p><h1>Un planeta que cambia.<br><span>Tu lugar en la historia.</span></h1></div><p>Elige un país o una zona del mapa y descubre cómo ha cambiado su temperatura. Gira la Tierra y recorre el tiempo.</p></section>
<section id="explorar" class="explorer-workspace" aria-label="Explorador del clima">
 <aside class="filters-panel"><div class="panel-title"><span class="step-number">1</span><h2>Elige dónde y cuándo</h2></div>
  <label for="place-type">¿Qué quieres explorar?</label><select id="place-type" disabled><option value="world">Todo el planeta</option><option value="country">Un país o territorio</option><option value="region">Una región del mundo</option><option value="sector">Un sector del mapa</option></select>
  <div id="country-fields" hidden><label for="country-search">Buscar país</label><input id="country-search" type="search" placeholder="Por ejemplo, Colombia" autocomplete="off"/><label class="sr-only" for="country-select">País o territorio</label><select id="country-select"><option value="">Selecciona un país</option></select><p id="country-results" class="field-help" aria-live="polite"></p></div>
  <div id="region-fields" hidden><label for="region-select">Región</label><select id="region-select"><option value="">Selecciona una región</option></select></div>
  <div id="sector-fields" hidden><label for="sector-size">Tamaño del sector</label><select id="sector-size"><option value="2">Un cuadro · 2° × 2°</option><option value="6">Hasta 9 cuadros · 6° × 6°</option><option value="10">Hasta 25 cuadros · 10° × 10°</option></select><p class="field-help">Haz clic o toca el globo para elegir el centro del sector. Incluye tierra y mar; cerca de los polos el área se recorta.</p></div>
  <details class="date-controls" open><summary><span>Período para comparar<small id="date-range-label"></small></span>${icon('chevron')}</summary><div class="date-fields"><label for="start-date">Desde</label><input id="start-date" type="month" required/><label for="end-date">Hasta</label><input id="end-date" type="month" required/><p id="range-error" class="field-error" role="alert"></p><div class="presets"><button data-range="all">Desde 1926</button><button data-range="recent">30 años</button></div></div></details>
  <details class="advanced"><summary>Más opciones ${icon('chevron')}</summary><div id="reference-fields"><label for="reference">Referencia global</label><select id="reference"><option value="preindustrial">1880–1900 · aproximación</option><option value="nasa">1951–1980 · NASA original</option></select></div><label for="window">Promedios de los extremos</label><select id="window"><option value="120">10 años</option><option value="60">5 años</option><option value="12">1 año</option></select><p class="field-help">Los países y sectores mantienen la referencia NASA de 1951–1980.</p></details>
  <button id="download" class="download-link">${icon('download')} Descargar datos CSV</button>
 </aside>
 <section class="map-panel" aria-label="Globo y línea de tiempo"><div class="map-heading"><div><span class="live-dot"></span><h2 id="map-place">Todo el planeta</h2></div><span id="map-date">Cargando datos…</span></div>
  <div class="map-layout"><div class="globe-stage"><div id="globe" aria-label="Globo de temperatura de la Tierra"></div><div id="map-loading" role="status"><span class="loader"></span>Preparando la Tierra…</div><div id="globe-tooltip" class="globe-tooltip" hidden></div><p id="map-hint" class="map-hint">Arrastra para girar · haz clic para elegir un país</p></div>
   <aside class="map-toolbar" aria-label="Controles del mapa"><div class="tool-group"><button id="zoom-in" aria-label="Acercar" title="Acercar">${icon('plus')}</button><button id="zoom-out" aria-label="Alejar" title="Alejar">${icon('minus')}</button></div><div class="tool-group"><button id="reset-view" aria-label="Restablecer vista" title="Restablecer vista">${icon('reset')}</button><button id="rotate" aria-label="Girar automáticamente" aria-pressed="false" title="Girar automáticamente">${icon('rotate')}</button></div><div class="relief-control"><label for="relief">${icon('layers')}<span>Relieve</span></label><input id="relief" type="range" min="0" max="2" value="1" step="0.1"/><output id="relief-value" for="relief">100 %</output></div><button id="sound-button" aria-label="Activar sonido" aria-pressed="false" title="Activar sonido">${icon('mute')}</button><span id="sound-status" class="sr-only" role="status">Sonido desactivado</span></aside>
  </div>
  <div class="map-legend"><span>Más frío</span><div class="color-scale" role="img" aria-label="Anomalía local NASA: azul menos 3 grados o menos, crema cero, rojo más 5 grados o más"><i></i><div><span>−3 °C</span><span>0</span><span>+5 °C</span></div></div><span>Más cálido</span><span class="map-missing-key"><i></i>Sin datos</span><button data-dialog="about-dialog" aria-label="Cómo leer los colores">${icon('info')}</button></div>
  <div class="playback"><button id="play" class="play-button" aria-label="Reproducir meses">${icon('play')}</button><div class="scrubber"><div><span id="scrub-start">1926</span><label for="time-slider" class="sr-only">Mes en la línea de tiempo</label><span id="scrub-end"></span></div><input id="time-slider" type="range" min="0" max="1" value="1" step="1"/></div><label for="frame-date" class="sr-only">Mes que estás viendo</label><input id="frame-date" type="month"/><label for="speed" class="sr-only">Velocidad</label><select id="speed" title="Velocidad"><option value="500">2 meses/s</option><option value="200" selected>5 meses/s</option><option value="100">10 meses/s</option></select></div>
 </section>
</section>
<div id="page-status" class="page-status" role="status">Cargando los registros de NASA…</div>
<section id="information" class="information" hidden><div class="information-heading"><div><p class="eyebrow">2 · ENTIENDE EL CAMBIO</p><h2 id="area-title">La historia de nuestro planeta</h2></div><span class="data-tag">NASA GISTEMP v4 <span>↗</span></span></div>
 <div class="summary-cards"><article class="summary-card current-card"><span id="current-date" class="card-label"></span><strong id="current-value"></strong><p id="current-explanation"></p><span id="coverage" class="coverage"></span></article><article class="summary-card"><span class="card-label">CAMBIO ENTRE LOS EXTREMOS</span><strong id="delta"></strong><p id="comparison-description"></p><span id="comparison-means" class="metric-note"></span></article><article class="summary-card"><span class="card-label">PROMEDIO DEL PERÍODO</span><strong id="period-mean"></strong><p id="period-caption"></p><button id="jump-warmest" class="warmest-link">Ver el mes más cálido ${icon('arrow')}</button></article></div>
 <p id="coverage-warning" class="coverage-warning" hidden></p>
 <section class="timeline-section"><div class="section-heading"><div><p class="eyebrow">3 · RECORRE SU HISTORIA</p><h2>¿Cómo ha cambiado con los años?</h2><p id="chart-subtitle"></p></div><label id="world-compare-label" class="checkbox-label" hidden><input id="world-compare" type="checkbox" checked/> Comparar con el mundo</label></div><div class="chart-legend"><span><i class="key monthly"></i> Cada mes</span><span><i class="key average"></i> Promedio de 12 meses</span><span id="global-key" hidden><i class="key world"></i> Promedio mundial</span></div><div class="timeline-container"><svg id="timeline" viewBox="0 0 900 280" role="img" aria-label="Evolución de la anomalía de temperatura"></svg><div id="chart-tooltip" class="chart-tooltip" hidden></div></div><div class="timeline-footnote"><p id="window-notice"></p><span>Haz clic en la gráfica para explorar un mes.</span></div><div id="paris-note" class="paris-note"></div></section>
 <section class="moment-section"><div class="moment-text"><p class="eyebrow">UN MOMENTO EN DETALLE</p><h2 id="moment-title"></h2><p id="moment-narrative"></p><div class="moment-facts"><div><span>Mismo mes, un año antes</span><strong id="previous-year"></strong><small id="previous-delta"></small></div><div><span id="year-average-label">Año hasta este mes</span><strong id="year-average"></strong><small id="year-count"></small></div></div><p class="variability-note">Un mes puede ser más cálido o más frío por la variabilidad natural. Para entender el cambio climático, observa los promedios de varios años.</p></div><div class="annual-panel"><div><h3 id="annual-title"></h3><span>Mes a mes</span></div><svg id="annual-chart" viewBox="0 0 400 200" role="img" aria-label="Anomalías de cada mes del año seleccionado"></svg><p>Las barras grises indican meses sin datos o fuera del período elegido.</p></div></section>
 <section class="explainer"><span class="explainer-icon">${icon('globe')}</span><div><h2>Lo que ves es cuánto ha cambiado.</h2><p>Una anomalía de <strong>+1 °C</strong> significa un grado por encima del promedio de referencia. El relieve hace visible ese cambio: <strong>no representa montañas</strong>.</p><p id="resolution-note">La malla de 2° representa datos regionales, no mediciones de cada ciudad.</p><button class="text-link" data-dialog="about-dialog">Entender los datos ${icon('arrow')}</button></div></section>
</section></main>
<footer><span class="footer-brand">${icon('globe')} TERMÓMETRO DE LA TIERRA</span><p>Ciencia abierta para entender un planeta compartido.</p><button data-dialog="sources-dialog">Fuentes y créditos ↗</button></footer>
<dialog id="about-dialog"><div class="dialog-top"><p class="eyebrow">CÓMO FUNCIONA</p><button class="dialog-close" aria-label="Cerrar">${icon('close')}</button></div><h2>El clima, paso a paso.</h2><h3>1. Elige un lugar</h3><p>Busca un país o territorio, elige una región o selecciona un sector del mapa. Un clic sobre tierra elige el país; sobre el océano elige un sector. En el modo sector, cada clic cambia el área de 2°, 6° o 10° que analizas.</p><h3>2. Viaja por los meses</h3><p>Usa la barra, escribe un mes o pulsa reproducir. El mapa, los indicadores y las gráficas se sincronizan. Arrastra o usa las flechas del teclado con el globo enfocado para girarlo; + y − cambian el zoom.</p><h3>3. Compara promedios</h3><p>Comparamos la primera ventana del período y la última, de igual duración y sin superposición. Puedes usar 1, 5 o 10 años. Si hace falta, se acortan por igual. Con menos de 24 meses, no se muestra una comparación.</p><h3>Qué significa cada color</h3><p>Los mapas siempre muestran anomalías locales respecto a 1951–1980. Azul significa menor anomalía, crema un valor próximo a cero y rojo mayor anomalía. Color y relieve cambian suavemente entre meses; los números corresponden al mes seleccionado. La escala de color se satura en −3 y +5 °C. La altura se suaviza entre zonas y se comprime progresivamente para evitar escalones. La selección se marca con un contorno y conserva los colores de temperatura. Solo las celdas sin datos NASA se muestran en gris claro.</p><h3>Detalle regional, con sus límites</h3><p>Usamos las 16.200 celdas de la malla original NASA de 2° con suavizado de 1.200 km. La cartografía de Natural Earth usa escala 1:50 millones, no precisión de 50 metros. Más detalle visual no equivale a mediciones de cada ciudad. Los promedios de países y regiones son estimaciones de esta aplicación, no índices nacionales oficiales.</p><p>Los pesos corresponden al área de cada celda que se superpone al territorio. Solo se promedian datos disponibles y se muestra su cobertura. Una cobertura variable también puede cambiar la serie. Usamos las mismas fronteras de referencia en todos los años, no fronteras históricas.</p><h3>La referencia global y París</h3><p id="baseline-explanation"></p><p>1880–1900 es una aproximación distinta de 1850–1900. Las líneas de +1,5 y +2 °C solo aparecen para el promedio mundial: no son umbrales de países o sectores. Un mes o un año por encima no prueba que se haya superado el objetivo climático de largo plazo.</p><h3>Escucha si lo prefieres</h3><p>El botón de sonido de la derecha activa notas propias sintetizadas. La anomalía del lugar seleccionado determina su frecuencia e intensidad. No necesitas sonido para usar la página; puedes desactivarlo en cualquier momento.</p></dialog>
<dialog id="sources-dialog"><div class="dialog-top"><p class="eyebrow">FUENTES ABIERTAS</p><button class="dialog-close" aria-label="Cerrar">${icon('close')}</button></div><h2>Datos para mirar de cerca.</h2><p>Los datos climáticos proceden de <a href="https://data.giss.nasa.gov/gistemp/" target="_blank" rel="noopener noreferrer">NASA GISS · GISTEMP v4</a>, con estaciones terrestres GHCN v4 y temperaturas oceánicas ERSST v5.</p><ul><li><a href="https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv" target="_blank" rel="noopener noreferrer">Tabla oficial de anomalías globales mensuales.</a></li><li><a href="https://data.giss.nasa.gov/gistemp/data_v4.html" target="_blank" rel="noopener noreferrer">Malla mensual original LOTI de 2°.</a></li><li>GISTEMP Team (2026), NASA Goddard Institute for Space Studies.</li><li><a href="https://doi.org/10.1029/2023JD040179" target="_blank" rel="noopener noreferrer">Lenssen et al. (2024), A GISTEMPv4 observational uncertainty ensemble.</a></li></ul><p id="data-vintage"></p><h3>Cartografía y recursos</h3><p>Natural Earth, dominio público. Three.js y Vite, MIT. Código, iconos y síntesis sonora propios, MIT. Tipografía del sistema.</p><p>El estilo visual toma como referencia la <a href="https://es.greenpeace.org/es/trabajamos-en/cambio-climatico/" target="_blank" rel="noopener noreferrer">página de cambio climático de Greenpeace España</a>. Este es un proyecto educativo independiente, sin vínculo institucional con Greenpeace o NASA.</p><p>Las series regionales se calculan a partir de las celdas NASA, ponderadas por superficie. La serie mundial conserva la tabla oficial; no se sustituye por el promedio de los mapas.</p></dialog>`;

for(const button of document.querySelectorAll('[data-dialog]'))button.addEventListener('click',()=>$('#'+button.dataset.dialog).showModal());
for(const dialog of document.querySelectorAll('dialog')) {
 const heading=dialog.querySelector('h2');heading.id=dialog.id+'-title';dialog.setAttribute('aria-labelledby',heading.id);
 dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
}
const regionalExplanation=[...$('#about-dialog').querySelectorAll('p')].find(p=>p.textContent.startsWith('Los pesos corresponden'));
regionalExplanation.insertAdjacentHTML('afterend','<p>Como criterio de calidad de esta aplicación, no calculamos un promedio regional con menos del 50 % del área disponible. Entre 50 % y 80 % mostramos el promedio con aviso de cobertura baja. Cada ventana de comparación también requiere al menos la mitad de sus meses con datos. Estos criterios de la aplicación no son umbrales oficiales de NASA. Para territorios muy pequeños, usa el buscador: la cartografía generalizada puede desplazar sus límites.</p>');
const smallScreen=window.matchMedia('(max-width:760px)');
$('.date-controls').open=!smallScreen.matches;
smallScreen.addEventListener('change',event=>{$('.date-controls').open=!event.matches;});

async function fetchAsset(path,binary=false) {
 const response=await fetch(`${import.meta.env.BASE_URL}${path}`);
 if(!response.ok)throw new Error(`No se pudo cargar ${path} (${response.status}).`);
 return binary?response.arrayBuffer():response.json();
}
async function fetchGrid(){
 if(typeof DecompressionStream==='function'){
  try{
   const compressed=await fetchAsset('data/grid-monthly.bin.gz',true);
   if(compressed.byteLength===meta.frames.length*meta.rows*meta.cols*2)return compressed;
   const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
   return await new Response(stream).arrayBuffer();
  }catch{/* Keep the original native binary as a compatibility fallback. */}
 }
 return fetchAsset('data/grid-monthly.bin',true);
}

async function init() {
 try {
  const result=await Promise.all([fetchAsset('data/global-monthly.json'),fetchAsset('data/grid-meta.json'),fetchAsset('data/areas.json'),fetchAsset('assets/countries-50m.json')]);
  [dataset,meta]=result;areas=result[2].areas;features=result[3].features;
  globalSeries=dataset.months.filter(r=>r.year>=1926).map(r=>({...r,coverage:Number.isFinite(r.anomaly)?1:0}));series=globalSeries;
  if(!globalSeries.length||!Number.isFinite(dataset.baseline1880To1900))throw new Error('Los registros no tienen el formato esperado.');
  const first=globalSeries[0],last=globalSeries.at(-1);
  for(const id of ['start-date','end-date']){$('#'+id).min=monthKey(first);$('#'+id).max=monthKey(last);}
  $('#start-date').value=monthKey(first);$('#end-date').value=monthKey(last);
  $('#baseline-explanation').textContent=`La tabla mundial original usa 1951–1980. Para la aproximación de 1880–1900 restamos su media global (${formatTemperature(dataset.baseline1880To1900)}), calculada con 252 meses. Este cambio de referencia solo se aplica a la serie mundial.`;
  $('#data-vintage').textContent=`Último mes disponible: ${longMonth(last)}. Consulta de la instantánea: 26 de octubre de 2026. NASA puede revisar registros anteriores.`;
  populatePlaces();bindControls();updateRange();$('#information').hidden=false;$('#page-status').textContent='La serie mundial está lista. Cargando los mapas para explorar lugares…';
  $('#map-loading').innerHTML='<span class="loader"></span>Cargando mapas y países…';
  const [buffer,earth]=await Promise.all([fetchGrid(),createGlobe($('#globe'),{onHover:showHover,onSelect:selectMapPoint})]);
  gridValues=new Int16Array(buffer);globe=earth;
  if(gridValues.length!==meta.frames.length*meta.rows*meta.cols)throw new Error('La malla de mapas está incompleta.');
  $('#place-type').disabled=false;$('#map-loading').hidden=true;$('#page-status').hidden=true;
  globe.setRelief(Number($('#relief').value));globe.setAutoRotate(false);updateFrame(false);
 }catch(error){console.error(error);$('#map-loading').hidden=true;$('#page-status').hidden=false;$('#page-status').classList.add('error');$('#page-status').innerHTML=`${escapeHtml(error.message)} <button id="retry">Volver a intentar</button>`;$('#retry').addEventListener('click',()=>location.reload());}
}

function populatePlaces(query='') {
 const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const countries=areas.filter(a=>a.type==='country'&&normalized(a.name).includes(normalized(query))).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 $('#country-select').innerHTML='<option value="">Selecciona un país</option>'+countries.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
 if(countries.some(a=>a.id===area.id))$('#country-select').value=area.id;
 $('#country-results').textContent=query?`${countries.length} coincidencia${countries.length!==1?'s':''}`:'';
 $('#region-select').innerHTML='<option value="">Selecciona una región</option>'+areas.filter(a=>a.type==='region').sort((a,b)=>a.name.localeCompare(b.name,'es')).map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
}

function bindControls() {
 for(const id of ['start-date','end-date','window'])$('#'+id).addEventListener('change',updateRange);
 $('#place-type').addEventListener('change',()=>{
  const mode=$('#place-type').value;
  $('#country-fields').hidden=mode!=='country';$('#region-fields').hidden=mode!=='region';$('#sector-fields').hidden=mode!=='sector';
  $('#map-hint').textContent=mode==='sector'?'Haz clic en el globo para elegir un sector':'Arrastra para girar · haz clic para elegir un país';
  if(mode==='world')chooseArea(WORLD);
  else if(mode==='country'&&$('#country-select').value)chooseArea(areas.find(a=>a.id===$('#country-select').value));
  else if(mode==='region'&&$('#region-select').value)chooseArea(areas.find(a=>a.id===$('#region-select').value));
  else if(mode==='sector'&&area.type==='sector')chooseArea(createSector(...area.center,Number($('#sector-size').value),meta));
 });
 $('#country-search').addEventListener('input',()=>{const query=$('#country-search').value;populatePlaces(query);const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();const exact=areas.find(a=>a.type==='country'&&normalize(a.name)===normalize(query));if(exact){$('#country-select').value=exact.id;chooseArea(exact);}});
 $('#country-search').addEventListener('keydown',e=>{if(e.key==='Enter'&&$('#country-select').value){e.preventDefault();chooseArea(areas.find(a=>a.id===$('#country-select').value));}});
 $('#country-select').addEventListener('change',()=>{const next=areas.find(a=>a.id===$('#country-select').value);if(next)chooseArea(next);});
 $('#region-select').addEventListener('change',()=>{const next=areas.find(a=>a.id===$('#region-select').value);if(next)chooseArea(next);});
 $('#sector-size').addEventListener('change',()=>{if(area.type==='sector')chooseArea(createSector(...area.center,Number($('#sector-size').value),meta));});
 $('#reference').addEventListener('change',()=>{reference=$('#reference').value;renderAnalysis();renderTimeline();updateFrame(false);});
 $('#world-compare').addEventListener('change',renderTimeline);
 $('#time-slider').addEventListener('input',()=>{current=Number($('#time-slider').value);updateFrame(true);});
 $('#frame-date').addEventListener('change',()=>{const index=selected.findIndex(r=>monthKey(r)===$('#frame-date').value);if(index>=0){current=index;updateFrame(true);}else $('#frame-date').value=monthKey(selected[current]);});
 $('#play').addEventListener('click',()=>timer?pause():play());
 $('#speed').addEventListener('change',()=>{if(timer){pause();play();}});
 $('#zoom-in').addEventListener('click',()=>globe?.zoomIn());$('#zoom-out').addEventListener('click',()=>globe?.zoomOut());
 $('#reset-view').addEventListener('click',()=>{globe?.resetView();if(area.type!=='world')globe?.focusOn(...area.center,3.0);});
 $('#rotate').addEventListener('click',()=>{const value=$('#rotate').getAttribute('aria-pressed')!=='true';$('#rotate').setAttribute('aria-pressed',String(value));$('#rotate').setAttribute('aria-label',value?'Detener giro automático':'Girar automáticamente');globe?.setAutoRotate(value);});
 $('#relief').addEventListener('input',()=>{const value=Number($('#relief').value);$('#relief-value').textContent=`${Math.round(value*100)} %`;globe?.setRelief(value);});
 $('#sound-button').addEventListener('click',async()=>{try{if(audio.enabled)audio.disable();else await audio.enable();$('#sound-button').innerHTML=icon(audio.enabled?'sound':'mute');$('#sound-button').setAttribute('aria-pressed',String(audio.enabled));$('#sound-button').setAttribute('aria-label',audio.enabled?'Desactivar sonido':'Activar sonido');$('#sound-status').textContent=audio.enabled?'Sonido activado para el lugar seleccionado':'Sonido desactivado';if(audio.enabled)audio.play(adjusted(selected[current].anomaly));}catch(error){$('#sound-status').textContent=error.message;}});
 for(const button of document.querySelectorAll('[data-range]'))button.addEventListener('click',()=>{$('#start-date').value=monthKey(button.dataset.range==='recent'?globalSeries[Math.max(0,globalSeries.length-360)]:globalSeries[0]);$('#end-date').value=monthKey(globalSeries.at(-1));updateRange();});
 $('#download').addEventListener('click',downloadCsv);
 $('#jump-warmest').addEventListener('click',()=>{const warmest=summarize(selected).warmest;if(warmest){current=selected.indexOf(warmest);updateFrame(true);}});
 $('#timeline').addEventListener('pointermove',e=>{const row=selected[chartIndex(e)];if(!row)return;const r=$('.timeline-container').getBoundingClientRect();const tip=$('#chart-tooltip');tip.hidden=false;tip.textContent=`${longMonth(row)} · ${formatTemperature(adjusted(row.anomaly))}`;tip.style.left=`${Math.min(Math.max(e.clientX-r.left,110),r.width-110)}px`;});
 $('#timeline').addEventListener('pointerleave',()=>{$('#chart-tooltip').hidden=true;});
 $('#timeline').addEventListener('click',e=>{current=chartIndex(e);updateFrame(true);});
 $('#annual-chart').addEventListener('click',e=>{const r=$('#annual-chart').getBoundingClientRect();const month=Math.max(1,Math.min(12,Math.floor(((e.clientX-r.left)/r.width*annualWidth-36)/(annualWidth-48)*12)+1));const index=selected.findIndex(row=>row.year===selected[current].year&&row.month===month);if(index>=0){current=index;updateFrame(true);}});
 new ResizeObserver(()=>{if(selected.length){renderTimeline();renderAnnual();}}).observe($('.timeline-container'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
}

function chooseArea(next) {
 if(!next||!gridValues)return;
 if(selected.length&&(!$('#start-date').validity.valid||!$('#end-date').validity.valid||$('#start-date').value>=$('#end-date').value)){$('#start-date').value=monthKey(selected[0]);$('#end-date').value=monthKey(selected.at(-1));}
 pause();const previous=selected[current]&&monthKey(selected[current]);area=next;
 if(area.type==='world')series=globalSeries;
 else {if(!seriesCache.has(area.id)){if(seriesCache.size>=24)seriesCache.delete(seriesCache.keys().next().value);seriesCache.set(area.id,regionalSeries(gridValues,meta,area));}series=seriesCache.get(area.id);}
 $('#reference-fields').hidden=area.type!=='world';$('#world-compare-label').hidden=area.type==='world';
 $('#map-place').textContent=area.name;
 const feature=features.find(f=>f.properties.id===area.id);
 globe?.setSelection(area.type==='world'?null:{...area,geometry:area.geometry||feature?.geometry});
 if(area.type==='world')globe?.resetView();else globe?.focusOn(...area.center,area.type==='region'?3.5:2.8);
 updateRange(previous);
}

function selectMapPoint(point) {
 if(!point||!gridValues)return;
 let next;
 if($('#place-type').value!=='sector') {
  const feature=findCountry(features.filter(f=>f.properties.type==='country'),point.longitude,point.latitude);
  if(feature)next=areas.find(a=>a.id===feature.properties.id);
 }
 if(next){$('#place-type').value='country';$('#country-fields').hidden=false;$('#region-fields').hidden=true;$('#sector-fields').hidden=true;$('#country-search').value='';populatePlaces();$('#country-select').value=next.id;}
 else {next=createSector(point.latitude,point.longitude,Number($('#sector-size').value),meta);$('#place-type').value='sector';$('#sector-fields').hidden=false;$('#country-fields').hidden=true;$('#region-fields').hidden=true;}
 $('#map-hint').textContent=next.type==='sector'?'Haz clic en el globo para elegir un sector':'Arrastra para girar · haz clic para elegir un país';
 chooseArea(next);
}

function offset(){return area.type==='world'?referenceOffset(dataset.baseline1880To1900,reference):0;}
function adjusted(value){return Number.isFinite(value)?value+offset():null;}
function referenceLabel(){return area.type==='world'&&reference==='preindustrial'?'1880–1900 · aproximación':'1951–1980 · NASA';}

function updateRange(preferred) {
 pause();if(!series.length)return;
 const start=$('#start-date').value,end=$('#end-date').value;
 if(!start||!end||!$('#start-date').validity.valid||!$('#end-date').validity.valid||start>=end||start<monthKey(globalSeries[0])||end>monthKey(globalSeries.at(-1))){$('#range-error').textContent=`Elige al menos dos meses entre ${shortMonth(globalSeries[0])} y ${shortMonth(globalSeries.at(-1))}. La fecha inicial debe ser anterior a la final.`;return;}
 $('#range-error').textContent='';const previous=typeof preferred==='string'?preferred:selected[current]&&monthKey(selected[current]);selected=series.filter(r=>monthKey(r)>=start&&monthKey(r)<=end);const found=selected.findIndex(r=>monthKey(r)===previous);current=found>=0?found:selected.length-1;
 $('#date-range-label').textContent=`${shortMonth(selected[0])} – ${shortMonth(selected.at(-1))}`;
 $('#time-slider').max=selected.length-1;$('#frame-date').min=monthKey(selected[0]);$('#frame-date').max=monthKey(selected.at(-1));$('#scrub-start').textContent=shortMonth(selected[0]);$('#scrub-end').textContent=shortMonth(selected.at(-1));
 renderAnalysis();renderTimeline();updateFrame(false);
}

function renderAnalysis() {
 const summary=summarize(selected),comparison=compareWindows(selected,Number($('#window').value));
 $('#area-title').textContent=area.type==='world'?'La historia de nuestro planeta':`Así ha cambiado ${area.name}`;
 $('#delta').textContent=comparison?formatTemperature(comparison.delta):'—';
 $('#comparison-description').textContent=comparison?`${shortMonth(comparison.first[0])}–${shortMonth(comparison.first.at(-1))} frente a ${shortMonth(comparison.last[0])}–${shortMonth(comparison.last.at(-1))}`:'Selecciona al menos 24 meses para comparar promedios.';
 $('#comparison-means').textContent=comparison?`${formatTemperature(adjusted(comparison.firstMean))} → ${formatTemperature(adjusted(comparison.lastMean))}`:'';
 $('#period-mean').textContent=formatTemperature(adjusted(summary.mean));
 $('#period-caption').textContent=`${summary.count.toLocaleString('es')} meses con datos · referencia ${referenceLabel()}`;
 $('#jump-warmest').disabled=!summary.warmest;$('#jump-warmest').innerHTML=summary.warmest?`${longMonth(summary.warmest)}: ${formatTemperature(adjusted(summary.warmest.anomaly))} ${icon('arrow')}`:'No hay meses válidos';
 $('#window-notice').textContent=comparison?`Ventanas de ${comparison.size} meses; ${comparison.firstValid} y ${comparison.lastValid} registros válidos.${comparison.shortened?' Se acortaron por igual para evitar que se superpongan.':''}${comparison.delta===null?' No hay suficientes observaciones: cada ventana requiere al menos la mitad de sus meses con datos.':''}`:'Para comparar se necesitan al menos 24 meses, con 12 meses por ventana.';
 $('#chart-subtitle').textContent=`${area.name} · diferencia respecto al promedio de ${referenceLabel()}.`;
 $('#paris-note').innerHTML=icon('info')+`<p>${area.type==='world'?'<strong>Los umbrales de París son de largo plazo.</strong> Usamos 1880–1900 como aproximación. Un mes o un año por encima de +1,5 °C no demuestra que se haya superado ese objetivo.':'<strong>El clima de un lugar no es el promedio mundial.</strong> Los umbrales de París solo se aplican al planeta completo; no se usan como límites para países, regiones o sectores.'}</p>`;
 $('#resolution-note').textContent=area.type==='world'?'El mapa usa las 16.200 celdas de 2° de NASA, siempre con referencia local 1951–1980. La gráfica mundial usa la tabla oficial.':'Estimación regional con celdas de 2° y suavizado de 1.200 km. No equivale a una estación meteorológica ni a un índice nacional oficial. Las fronteras de referencia se aplican a todos los años.';
}

function updateFrame(withSound=false) {
 if(!selected.length)return;
 const row=selected[current];$('#map-date').textContent=longMonth(row);$('#current-date').textContent=longMonth(row);
 $('#time-slider').value=current;$('#frame-date').value=monthKey(row);$('#time-slider').setAttribute('aria-valuetext',`${longMonth(row)}: ${formatTemperature(adjusted(row.anomaly))}`);
 const value=adjusted(row.anomaly);$('#current-value').textContent=formatTemperature(value);$('#current-value').classList.toggle('cool',value<0);
 $('#current-explanation').textContent=value===null?(area.type!=='world'&&row.coverage>0?'Cobertura insuficiente: se necesita al menos el 50 % del área.':'Sin datos para este lugar y mes.'):`${value>=0?'Por encima':'Por debajo'} del promedio de ${referenceLabel()}.`;
 $('#coverage').textContent=area.type==='world'?'Media mundial oficial de NASA':`Cobertura: ${percent(row.coverage)} del área seleccionada`;
 $('#coverage-warning').hidden=area.type==='world'||row.coverage>=.8;
 $('#coverage-warning').textContent=`En este mes hay datos para el ${percent(row.coverage)} del área. ${row.coverage<.5?'No calculamos un promedio con menos del 50 % de cobertura.':'La cobertura es baja; el promedio puede no representar todo el lugar.'} Las variaciones de cobertura también afectan la comparación entre meses.`;
 if(globe&&gridValues){const f=meta.frames.findIndex(r=>r.year===row.year&&r.month===row.month),size=meta.rows*meta.cols;globe.setFrame({...meta,values:f>=0?gridValues.subarray(f*size,(f+1)*size):new Int16Array(size).fill(meta.missing),offset:0,transitionMs:Math.min(Number($('#speed').value),400)});}
 const marker=$('#chart-marker');if(marker){marker.setAttribute('x1',chartX(current));marker.setAttribute('x2',chartX(current));}
 renderMoment();renderAnnual();if(withSound)audio.play(value);
}

function renderMoment() {
 const row=selected[current],details=yearDetails(series,row),value=adjusted(row.anomaly),previous=adjusted(details.previous?.anomaly);
 $('#moment-title').textContent=`${longMonth(row)}${area.type==='world'?' en el planeta':` en ${area.name}`}`;
 $('#moment-narrative').textContent=value===null?'No hay observaciones suficientes para calcular una anomalía representativa en este mes. Los promedios regionales requieren al menos el 50 % del área con datos. Puedes elegir otro momento en la línea de tiempo.':`En este mes, la temperatura media ${area.type==='world'?'mundial':'del área seleccionada'} fue ${Math.abs(value).toFixed(2).replace('.',',')} °C ${value>=0?'mayor':'menor'} que su promedio de referencia (${referenceLabel()}).`;
 $('#previous-year').textContent=formatTemperature(previous);$('#previous-delta').textContent=Number.isFinite(value)&&Number.isFinite(previous)?`Diferencia interanual: ${formatTemperature(value-previous)}`:'No hay comparación interanual disponible.';
 $('#year-average-label').textContent=`${row.year} hasta este mes`;$('#year-average').textContent=formatTemperature(adjusted(details.yearMean));$('#year-count').textContent=`${details.yearCount} ${details.yearCount===1?'mes válido':'meses válidos'} de enero a ${new Intl.DateTimeFormat('es',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(row.year,row.month-1,1)))}.`;
}

function play(){if(!selected.length)return;if(current>=selected.length-1)current=0;updateFrame(true);$('#play').innerHTML=icon('pause');$('#play').setAttribute('aria-label','Pausar reproducción');timer=setInterval(()=>{if(current>=selected.length-1){pause();return;}current++;updateFrame(true);},Number($('#speed').value));}
function pause(){clearInterval(timer);timer=null;$('#play').innerHTML=icon('play');$('#play').setAttribute('aria-label','Reproducir meses');}
function showHover(cell){const tip=$('#globe-tooltip');tip.hidden=!cell;if(cell)tip.innerHTML=`<span>${Math.abs(cell.latitude)}° ${cell.latitude>=0?'N':'S'} · ${Math.abs(cell.longitude)}° ${cell.longitude>=0?'E':'O'}</span><strong>${formatTemperature(cell.anomaly)}</strong><small>Celda NASA · 1951–1980</small>`;}

const chartX=i=>48+i/(selected.length-1)*(chartWidth-70);
function chartIndex(e){const r=$('#timeline').getBoundingClientRect();return Math.max(0,Math.min(selected.length-1,Math.round(((e.clientX-r.left)/r.width*chartWidth-48)/(chartWidth-70)*(selected.length-1))));}
function renderTimeline() {
 if(!selected.length)return;
 chartWidth=Math.max(300,$('#timeline').clientWidth);$('#timeline').setAttribute('viewBox',`0 0 ${chartWidth} 280`);
 const values=selected.map(r=>adjusted(r.anomaly)),adjust=offset();
 const global=selected.map(r=>globalSeries.find(g=>monthKey(g)===monthKey(r))?.anomaly??null);
 const showWorld=area.type!=='world'&&$('#world-compare').checked;$('#global-key').hidden=!showWorld;
 const paris=area.type==='world'?[1.5,2].map(v=>v+dataset.baseline1880To1900+adjust):[];
 const moving=selected.map(row=>{const index=series.findIndex(r=>monthKey(r)===monthKey(row));const value=rollingMean(series,index);return Number.isFinite(value)?value+adjust:null;});
 const range=[...values,...moving,...(showWorld?global:[]),...paris].filter(Number.isFinite);const min=Math.floor(Math.min(-.2,...range)/.5)*.5,max=Math.max(min+1,Math.ceil(Math.max(.5,...range)/.5)*.5+.15);
 const y=v=>238-(v-min)/(max-min)*210;
 const line=arr=>{let open=false;return arr.map((v,i)=>{if(!Number.isFinite(v)){open=false;return'';}const point=`${open?'L':'M'}${chartX(i).toFixed(2)},${y(v).toFixed(2)}`;open=true;return point;}).join(' ');};
 let html=`<title>Temperatura de ${escapeHtml(area.name)}</title><desc>Anomalías mensuales y promedio de doce meses. La línea vertical marca el mes seleccionado. También puedes explorar los valores con el control mensual o descargar CSV.</desc>`;
 const step=(max-min)>4?1:.5;
 for(let v=Math.ceil(min/step)*step;v<=max;v+=step)html+=`<line x1="48" x2="${chartWidth-22}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e7df"/><text x="37" y="${y(v)+4}" text-anchor="end" class="chart-label">${v.toFixed(1).replace('.',',')}°</text>`;
 for(let i=0;i<paris.length;i++)html+=`<line x1="48" x2="${chartWidth-22}" y1="${y(paris[i])}" y2="${y(paris[i])}" stroke="${i?'#c95b43':'#bc8a25'}" stroke-dasharray="4 5"/><text x="${chartWidth-22}" y="${y(paris[i])-6}" text-anchor="end" class="threshold-label" fill="${i?'#ad4b37':'#966f21'}">PARÍS +${i?'2,0':'1,5'} °C</text>`;
 if(showWorld)html+=`<path d="${line(global)}" fill="none" stroke="#747d73" stroke-width="1.4" stroke-dasharray="4 4"/>`;
 html+=`<path d="${line(values)}" fill="none" stroke="#87b878" stroke-width="1.3" stroke-opacity=".75"/><path d="${line(moving)}" fill="none" stroke="#1d6511" stroke-width="2.8" stroke-linejoin="round"/>`;
 const ticks=chartWidth<500?3:6;for(let t=0;t<=ticks;t++){const i=Math.round(t/ticks*(selected.length-1));html+=`<text x="${chartX(i)}" y="265" text-anchor="middle" class="chart-label">${selected.length>36?selected[i].year:shortMonth(selected[i])}</text>`;}
 html+=`<line id="chart-marker" x1="${chartX(current)}" x2="${chartX(current)}" y1="25" y2="240" stroke="#171d15" stroke-dasharray="3 4"/>`;
 const comparison=compareWindows(selected,Number($('#window').value));if(comparison)html+=`<path d="M${chartX(0)} 279H${chartX(comparison.size-1)} M${chartX(selected.length-comparison.size)} 279H${chartX(selected.length-1)}" stroke="#2ab20b" stroke-width="3"/>`;
 $('#timeline').innerHTML=html;
}

function renderAnnual() {
 if(!selected.length)return;
 const row=selected[current];$('#annual-title').textContent=`El año ${row.year} en detalle`;
 annualWidth=Math.max(290,$('#annual-chart').clientWidth);$('#annual-chart').setAttribute('viewBox',`0 0 ${annualWidth} 205`);
 const months=yearDetails(series,row).months.map(r=>monthKey(r)>=monthKey(selected[0])&&monthKey(r)<=monthKey(selected.at(-1))?r:{...r,anomaly:null});
 const values=months.map(r=>adjusted(r.anomaly));const min=Math.floor(Math.min(0,...values.filter(Number.isFinite))/.5)*.5,max=Math.max(.5,Math.ceil(Math.max(0,...values.filter(Number.isFinite))/.5)*.5);
 const y=v=>169-(v-min)/(max-min)*141;const width=(annualWidth-48)/12;
 let html='<title>Anomalías mensuales del año seleccionado</title>';
 for(const v of [min,max])html+=`<text x="28" y="${y(v)+4}" text-anchor="end" class="chart-label">${v.toFixed(1).replace('.',',')}°</text>`;
 html+=`<line x1="36" x2="${annualWidth-12}" y1="${y(0)}" y2="${y(0)}" stroke="#b7c1b3"/>`;
 const labels=['E','F','M','A','M','J','J','A','S','O','N','D'];
 for(let i=0;i<12;i++){const v=values[i],x=36+i*width+3;const top=Number.isFinite(v)?Math.min(y(v),y(0)):165;const h=Number.isFinite(v)?Math.max(2,Math.abs(y(v)-y(0))):4;html+=`<rect x="${x}" y="${top}" width="${Math.max(4,width-6)}" height="${h}" rx="2" fill="${Number.isFinite(v)?temperatureColor(v):'#d9ddd5'}" ${i+1===row.month?'stroke="#111b0e" stroke-width="2"':''}/><text x="${x+(width-6)/2}" y="192" text-anchor="middle" class="chart-label">${labels[i]}</text>`;}
 $('#annual-chart').innerHTML=html;
}

function downloadCsv() {
 if(!selected.length)return;
 const rows=selected.map(row=>{const global=globalSeries.find(g=>monthKey(g)===monthKey(row));return `${monthKey(row)},${row.anomaly??''},${Number.isFinite(row.anomaly)?adjusted(row.anomaly).toFixed(4):''},${row.coverage.toFixed(6)},${global?.anomaly??''}`;});
 const csv=`# NASA GISS/GISTEMP v4; lugar=${area.name}; referencia seleccionada=${referenceLabel()}\n# Regiones: promedio por superficie de celdas NASA2 grados; cobertura=fraccion de area con datos; no indice nacional oficial\nfecha,anomalia_lugar_1951_1980_C,anomalia_referencia_seleccionada_C,cobertura_fraccion,anomalia_mundial_1951_1980_C\n${rows.join('\n')}`;
 const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`NASA-${area.id}-${monthKey(selected[0])}_${monthKey(selected.at(-1))}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
init();
