import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PALETTE } from './climate.js';
import { createSurface, createSurfaceMesh, fillSurfaceTargets, updateSurface, INNER_GLOBE_RADIUS, MISSING_SURFACE_COLOR, VERTICES_PER_CELL, TRIANGLES_PER_CELL } from './globe-surface.js';

export const TEMPERATURE_PALETTE = PALETTE;
const clamp = THREE.MathUtils.clamp;
const radians = Math.PI / 180;
function point(latitude, longitude, radius = 1, target = new THREE.Vector3()) {
  const lat = latitude * radians, lon = longitude * radians;
  return target.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(radius);
}
function ease(t) { return t * t * (3 - 2 * t); }
function atmosphere() {
  return new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 40), new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vNormal; varying vec3 vView;
      void main() { vec4 p=modelViewMatrix*vec4(position,1.0);
        vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz);
        gl_Position=projectionMatrix*p; }`,
    fragmentShader: `varying vec3 vNormal; varying vec3 vView;
      void main() { float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.2);
        gl_FragColor=vec4(0.27,0.62,0.70,rim*0.16); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  }));
}

// GPU blending changes only the visual encoding. Native measured values are
// retained for selection and hover; scientific calculations never use a blend.
function thermalMaterial(morph) {
  return new THREE.ShaderMaterial({
    uniforms: { uGlobeMorph: morph },
    vertexShader: `uniform float uGlobeMorph;
      attribute vec3 aUnit; attribute float aRadiusFrom; attribute float aRadiusTo;
      attribute vec3 aColorFrom; attribute vec3 aColorTo;
      attribute vec3 aNormalFrom; attribute vec3 aNormalTo;
      varying vec3 vThermalColor; varying vec3 vReliefNormal;
      void main() {
        vec3 transformed=aUnit*mix(aRadiusFrom,aRadiusTo,uGlobeMorph);
        vThermalColor=mix(aColorFrom,aColorTo,uGlobeMorph);
        vReliefNormal=normalize(normalMatrix*normalize(mix(aNormalFrom,aNormalTo,uGlobeMorph)));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.0);
      }`,
    fragmentShader: `varying vec3 vThermalColor; varying vec3 vReliefNormal;
      void main() {
        float light=max(0.0,dot(normalize(vReliefNormal),normalize(vec3(-0.3,0.6,1.0))));
        float shade=0.90+0.10*light;
        gl_FragColor=vec4(vThermalColor*shade,1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide, toneMapped: false,
  });
}
function lineMaterial(morph, { color = '#203b35', opacity = 0.8 } = {}) {
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  material.onBeforeCompile = shader => {
    shader.uniforms.uGlobeMorph = morph;
    shader.vertexShader = `uniform float uGlobeMorph; attribute vec3 aUnit;
      attribute float aRadiusFrom; attribute float aRadiusTo;
      ${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed=aUnit*mix(aRadiusFrom,aRadiusTo,uGlobeMorph);');
  };
  material.customProgramCacheKey = () => 'native-coast-morph-v2';
  return material;
}
function decodedArcs(topology) {
  const { scale, translate } = topology.transform;
  return topology.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(delta => { x += delta[0]; y += delta[1]; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
  });
}

/** Native NASA grid. scale multiplies raw values in °C. Corner smoothing and
 * monthly transitions are visual only. onSelect returns clicked coordinates
 * plus the native measured cell index. Missing data are never fabricated. */
export async function createGlobe(container, { onHover = () => {}, onSelect = () => {}, onReady = () => {} } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch {
    const notice = document.createElement('p');
    notice.className = 'globe-fallback'; notice.setAttribute('role', 'status');
    notice.textContent = 'El globo 3D necesita WebGL 2. Activa la aceleración gráfica o prueba otro navegador. La gráfica, los datos y el sonido siguen disponibles.';
    container.append(notice); onReady({ available: false });
    return { available: false, setFrame() {}, setRelief() {}, setAutoRotate() {}, setSelection() {}, focusOn() {}, zoomIn() {}, zoomOut() {}, resetView() {}, resize() {}, dispose() { notice.remove(); } };
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(39, 1, 0.1, 30);
  const canvas = renderer.domElement;
  canvas.className = 'earth-canvas'; canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Globo de anomalías de temperatura. Selecciona un país o sector haciendo clic o tocándolo. Arrastra para girar, usa la rueda o pellizca para acercar. Teclado: flechas para girar, más y menos para acercar, Inicio para restablecer.');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
  container.append(canvas);
  renderer.setClearColor('#eef3f2', 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.075; controls.enablePan = false;
  controls.minDistance = 1.62; controls.maxDistance = 5.6; controls.autoRotate = false;
  controls.autoRotateSpeed = 0.3; controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.65;
  scene.add(new THREE.AmbientLight('#ecf7fa', 2.15));
  const sun = new THREE.DirectionalLight('#fff6e5', 2.5); sun.position.set(-3, 5, 6); scene.add(sun);
  const rim = new THREE.DirectionalLight('#88b3c2', 0.65); rim.position.set(3, -1, -3); scene.add(rim);
  const base = new THREE.Mesh(new THREE.SphereGeometry(INNER_GLOBE_RADIUS, 96, 64), new THREE.MeshBasicMaterial({ color: MISSING_SURFACE_COLOR, toneMapped: false }));
  scene.add(base, atmosphere());
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), new THREE.MeshBasicMaterial({ color: '#17251e' }));
  marker.visible = false; scene.add(marker);

  let frame = null, heatMesh = null, coast = null, selectionLine = null, selection = null;
  let relief = 1, disposed = false, animation, hoveringIndex = -1, dragging = false;
  let gridKey = '', surface, cornerRadii;
  let transitioning = false, transitionStart = 0, transitionDuration = 400;
  let hoverRequested = false, selectRequested = false, touchInteraction = false, tapCandidate = null;
  let cameraTransition = null, lastTime = performance.now();
  const morph = { value: 1 }, pointer = new THREE.Vector2(10, 10), raycaster = new THREE.Raycaster();
  const scratch = new THREE.Vector3(), activePointers = new Set();
  const valueAt = index => {
    if (!frame) return null;
    const raw = frame.values[index];
    return raw === frame.missing || !Number.isFinite(raw) ? null : raw * frame.scale + frame.offset;
  };
  function updateMorph(now = performance.now()) {
    if (!transitioning) return;
    const t = clamp((now - transitionStart) / transitionDuration, 0, 1);
    morph.value = ease(t); if (t === 1) transitioning = false;
  }
  function createGrid(){
  surface=createSurface(frame); cornerRadii=surface.cornerRadii;
  const count=surface.cells,stride=VERTICES_PER_CELL,{units,indices}=createSurfaceMesh(surface);
  if(heatMesh){scene.remove(heatMesh);heatMesh.geometry.dispose();heatMesh.material.dispose();}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('aUnit',new THREE.BufferAttribute(units,3));
  geometry.setAttribute('position',new THREE.BufferAttribute(units.slice(),3));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  for(const name of ['aRadiusFrom','aRadiusTo']) geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(count*stride),1).setUsage(THREE.DynamicDrawUsage));
  for(const name of ['aColorFrom','aColorTo','aNormalFrom','aNormalTo']) geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(count*stride*3),3).setUsage(THREE.DynamicDrawUsage));
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1.12);
  heatMesh=new THREE.Mesh(geometry,thermalMaterial(morph));scene.add(heatMesh);
}
  function smoothCorners(){updateSurface(surface,frame.values,{scale:frame.scale,missing:frame.missing,offset:frame.offset,relief});cornerRadii=surface.cornerRadii;}
  function cornerRadius(latitude, longitude) {
    if (!frame || !cornerRadii) return 1.011;
    const fy = clamp((latitude - (frame.latitudes[0] - frame.stepLat / 2)) / frame.stepLat, 0, frame.rows - 0.00001);
    const fx = (((longitude - (frame.longitudes[0] - frame.stepLon / 2)) % 360 + 360) % 360) / frame.stepLon;
    const row = Math.floor(fy), col = Math.floor(fx), y = fy - row, x = fx - col, i = row * (frame.cols + 1) + col;
    return (cornerRadii[i] * (1 - x) + cornerRadii[i + 1] * x) * (1 - y) + (cornerRadii[i + frame.cols + 1] * (1 - x) + cornerRadii[i + frame.cols + 2] * x) * y;
  }
  function makeLine(coordinates, options) {
    const units = new Float32Array(coordinates.length * 3), from = new Float32Array(coordinates.length), to = new Float32Array(coordinates.length);
    coordinates.forEach(([longitude, latitude], i) => { point(latitude, longitude, 1, scratch).toArray(units, i * 3); from[i] = to[i] = cornerRadius(latitude, longitude) + (options?.lift ?? 0.003); });
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(units.slice(), 3)); geometry.setAttribute('aUnit', new THREE.BufferAttribute(units, 3));
    geometry.setAttribute('aRadiusFrom', new THREE.BufferAttribute(from, 1).setUsage(THREE.DynamicDrawUsage)); geometry.setAttribute('aRadiusTo', new THREE.BufferAttribute(to, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
    const line = new THREE.LineSegments(geometry, lineMaterial(morph, options)); line.userData.coordinates = coordinates; line.userData.lift = options?.lift ?? 0.003; return line;
  }
  function prepareLine(line, blend, first) {
    if (!line) return;
    const from = line.geometry.attributes.aRadiusFrom, to = line.geometry.attributes.aRadiusTo;
    line.userData.coordinates.forEach(([longitude, latitude], i) => {
      const target = cornerRadius(latitude, longitude) + line.userData.lift;
      from.array[i] = first ? target : from.array[i] + (to.array[i] - from.array[i]) * blend; to.array[i] = target;
    });
    from.needsUpdate = true; to.needsUpdate = true;
  }
  function prepareFrame(first=false,duration=400){
  if(!frame||!heatMesh)return;updateMorph();const blend=morph.value;smoothCorners();
  const attrs=heatMesh.geometry.attributes;
  for(const [fromName,toName]of[['aRadiusFrom','aRadiusTo'],['aColorFrom','aColorTo'],['aNormalFrom','aNormalTo']]){
    const from=attrs[fromName].array,to=attrs[toName].array;
    if(!first)for(let i=0;i<from.length;i++)from[i]+=(to[i]-from[i])*blend;
  }
  fillSurfaceTargets(surface,{radii:attrs.aRadiusTo.array,colors:attrs.aColorTo.array,normals:attrs.aNormalTo.array});
  if(first){attrs.aRadiusFrom.array.set(attrs.aRadiusTo.array);attrs.aColorFrom.array.set(attrs.aColorTo.array);attrs.aNormalFrom.array.set(attrs.aNormalTo.array);}
  for(const name of ['aRadiusFrom','aRadiusTo','aColorFrom','aColorTo','aNormalFrom','aNormalTo'])attrs[name].needsUpdate=true;
  prepareLine(coast,blend,first);prepareLine(selectionLine,blend,first);transitionDuration=reducedMotion?0:clamp(duration,0,1200);transitioning=!first&&transitionDuration>0;transitionStart=performance.now();morph.value=transitioning?0:1;
  if(hoveringIndex>=0)publishHover(hoveringIndex);
}
  function cellInfo(index) {
    const row = Math.floor(index / frame.cols), col = index % frame.cols, anomaly = valueAt(index);
    return { latitude: frame.latitudes[row], longitude: frame.longitudes[col], index, anomaly, rawAnomaly: anomaly === null ? null : frame.values[index] * frame.scale, missing: anomaly === null };
  }
  function publishHover(index) {
    hoveringIndex = index;
    if (!frame || index < 0) { marker.visible = false; onHover(null); return; }
    const info = cellInfo(index); marker.visible = info.anomaly !== null;
    point(info.latitude, info.longitude, cornerRadius(info.latitude, info.longitude) + 0.014, marker.position); onHover(info);
  }
  function performPick(select = false) {
    if (!heatMesh || dragging || !frame) return;
    // Raycast the exact currently displayed surface using a CPU-only copy.
    // Rendering uses immutable aUnit, so this does not upload geometry again.
    const attrs = heatMesh.geometry.attributes, units = attrs.aUnit.array, positions = attrs.position.array;
    for (let vertex = 0; vertex < attrs.position.count; vertex += 1) {
      const radius = attrs.aRadiusFrom.array[vertex] + (attrs.aRadiusTo.array[vertex] - attrs.aRadiusFrom.array[vertex]) * morph.value, i = vertex * 3;
      positions[i] = units[i] * radius; positions[i + 1] = units[i + 1] * radius; positions[i + 2] = units[i + 2] * radius;
    }
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(heatMesh, false)[0], index = hit ? Math.floor(hit.faceIndex / TRIANGLES_PER_CELL) : -1;
    if (index !== hoveringIndex || select) publishHover(index); canvas.style.cursor = index >= 0 ? 'pointer' : 'grab';
    if (select && hit) {
      const info = cellInfo(index), radius = hit.point.length();
      onSelect({ ...info, latitude: Math.asin(clamp(hit.point.y / radius, -1, 1)) / radians, longitude: Math.atan2(hit.point.x, hit.point.z) / radians, cellLatitude: info.latitude, cellLongitude: info.longitude });
    }
  }
  function setPointer(event) { const bounds = canvas.getBoundingClientRect(); pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1); }
  function move(event) {
    if (tapCandidate?.id === event.pointerId && Math.hypot(event.clientX - tapCandidate.x, event.clientY - tapCandidate.y) >= 8) tapCandidate = null;
    if (event.pointerType === 'touch') return; setPointer(event); hoverRequested = true;
  }
  function leave() { pointer.set(10, 10); hoverRequested = false; publishHover(-1); }
  function startDrag() { dragging = true; cameraTransition = null; publishHover(-1); canvas.style.cursor = 'grabbing'; }
  function endDrag() { dragging = false; if (!touchInteraction) hoverRequested = true; }
  function pointerDown(event) {
    touchInteraction = event.pointerType === 'touch'; activePointers.add(event.pointerId);
    tapCandidate = activePointers.size === 1 && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  }
  function pointerUp(event) {
    activePointers.delete(event.pointerId); const tap = tapCandidate; tapCandidate = null;
    if (!tap || tap.id !== event.pointerId || activePointers.size || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) >= 8) return;
    setPointer(event); selectRequested = true;
  }
  function pointerCancel(event) { activePointers.delete(event.pointerId); tapCandidate = null; leave(); }
  function outsidePointer(event) { if (!canvas.contains(event.target)) publishHover(-1); }
  canvas.addEventListener('pointerdown', pointerDown, true); canvas.addEventListener('pointerup', pointerUp, true); canvas.addEventListener('pointercancel', pointerCancel, true);
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', leave); document.addEventListener('pointerdown', outsidePointer, true);
  controls.addEventListener('start', startDrag); controls.addEventListener('end', endDrag);
  function focusOn(latitude, longitude, zoom = 2.8) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const from = new THREE.Spherical().setFromVector3(camera.position);
    const target = new THREE.Spherical().setFromVector3(point(clamp(latitude, -85, 85), longitude, clamp(Number(zoom) || 2.8, controls.minDistance, controls.maxDistance)));
    target.theta = from.theta + Math.atan2(Math.sin(target.theta - from.theta), Math.cos(target.theta - from.theta));
    cameraTransition = { from, target, start: performance.now(), duration: reducedMotion ? 0 : 650 };
  }
  function zoomBy(factor) { const s = new THREE.Spherical().setFromVector3(camera.position); focusOn(90 - s.phi / radians, s.theta / radians, s.radius * factor); }
  function resetView() { cameraTransition = null; camera.position.copy(point(17, -60, 3.55)); controls.target.set(0, 0, 0); controls.update(); }
  function keyboard(event) {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home', 'Enter', ' '].includes(key)) return;
    event.preventDefault(); if (key === 'Enter' || key === ' ') { pointer.set(0, 0); selectRequested = true; return; }
    cameraTransition = null; const s = new THREE.Spherical().setFromVector3(camera.position);
    if (key === 'ArrowLeft') s.theta -= 0.08; if (key === 'ArrowRight') s.theta += 0.08;
    if (key === 'ArrowUp') s.phi = Math.max(0.08, s.phi - 0.08); if (key === 'ArrowDown') s.phi = Math.min(Math.PI - 0.08, s.phi + 0.08);
    if (key === '+' || key === '=') s.radius = Math.max(controls.minDistance, s.radius * 0.9);
    if (key === '-' || key === '_') s.radius = Math.min(controls.maxDistance, s.radius * 1.1);
    if (key === 'Home') resetView(); else { camera.position.setFromSpherical(s); controls.update(); }
  }
  canvas.addEventListener('keydown', keyboard);
  function setSelection(value) {
    selection = value;
    if (selectionLine) { scene.remove(selectionLine); selectionLine.geometry.dispose(); selectionLine.material.dispose(); selectionLine = null; }
    const geometry = value?.geometry?.type === 'Feature' ? value.geometry.geometry : value?.geometry;
    if (!geometry) return;
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [], coordinates = [];
    for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i += 1) {
      const a = ring[i - 1], b = ring[i], deltaLon = Math.atan2(Math.sin((b[0] - a[0]) * radians), Math.cos((b[0] - a[0]) * radians)) / radians;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(deltaLon), Math.abs(b[1] - a[1])) / 0.75));
      for (let step = 0; step < steps; step += 1) coordinates.push([a[0] + deltaLon * step / steps, a[1] + (b[1] - a[1]) * step / steps], [a[0] + deltaLon * (step + 1) / steps, a[1] + (b[1] - a[1]) * (step + 1) / steps]);
    }
    if (coordinates.length) { selectionLine = makeLine(coordinates, { color: '#122a1c', opacity: 1, lift: 0.010 }); scene.add(selectionLine); }
  }
  function resize() {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight); camera.aspect = width / height;
    camera.fov = Math.max(39, 2 * Math.atan(Math.tan(39 * radians / 2) / Math.min(1, camera.aspect)) / radians);
    camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize(); resetView();
  function draw(now) {
    if (disposed) return; updateMorph(now);
    if (cameraTransition) {
      const { from, target, start, duration } = cameraTransition, t = duration ? clamp((now - start) / duration, 0, 1) : 1, blend = ease(t);
      camera.position.setFromSpherical(new THREE.Spherical(THREE.MathUtils.lerp(from.radius, target.radius, blend), THREE.MathUtils.lerp(from.phi, target.phi, blend), THREE.MathUtils.lerp(from.theta, target.theta, blend)));
      if (t === 1) cameraTransition = null;
    }
    const autoRotate = controls.autoRotate;
    if (cameraTransition) controls.autoRotate = false;
    controls.update(Math.min((now - lastTime) / 1000, 0.1)); controls.autoRotate = autoRotate; lastTime = now; renderer.render(scene, camera);
    if (selectRequested && !dragging) { selectRequested = false; hoverRequested = false; performPick(true); }
    else if (hoverRequested && !dragging) { hoverRequested = false; performPick(); }
    animation = requestAnimationFrame(draw);
  }
  animation = requestAnimationFrame(draw);
  fetch(`${import.meta.env.BASE_URL}assets/land-50m.json`).then(response => { if (!response.ok) throw new Error('No se pudo cargar la costa'); return response.json(); })
    .then(topology => {
      if (disposed) return;
      const arcs = decodedArcs(topology), coordinates = [];
      for (const arc of arcs) for (let i = 1; i < arc.length; i += 1) coordinates.push(arc[i - 1], arc[i]);
      coast = makeLine(coordinates, { color: '#203c36', opacity: 0.75, lift: 0.0035 }); scene.add(coast);

    }).catch(() => { /* Scientific data work independently of cartography. */ });
  const api = {
    available: true,
    setFrame(input, options = {}) {
      if (!input?.values || !input.latitudes?.length || !input.longitudes?.length) return;
      frame = { scale: 0.01, missing: -32768, offset: 0, ...input };
      frame.rows ??= frame.latitudes.length; frame.cols ??= frame.longitudes.length;
      frame.stepLat ??= frame.latitudes.length > 1 ? Math.abs(frame.latitudes[1] - frame.latitudes[0]) : 2;
      frame.stepLon ??= frame.longitudes.length > 1 ? Math.abs(frame.longitudes[1] - frame.longitudes[0]) : 2;
      const key = `${frame.rows}:${frame.cols}:${frame.stepLat}:${frame.stepLon}`, first = key !== gridKey;
      if (first) { gridKey = key; createGrid(); }
      prepareFrame(first, options.transitionMs ?? options.transitionms ?? input.transitionMs ?? input.transitionms ?? 400);
    },
    setRelief(value) { relief = clamp(Number(value) || 0, 0, 2); prepareFrame(false, 220); },
    setAutoRotate(value) { controls.autoRotate = Boolean(value); },
    setSelection, focusOn, zoomIn() { zoomBy(0.82); }, zoomOut() { zoomBy(1.22); }, resetView, resize,
    dispose() {
      disposed = true; cancelAnimationFrame(animation); observer.disconnect(); controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown, true); canvas.removeEventListener('pointerup', pointerUp, true); canvas.removeEventListener('pointercancel', pointerCancel, true);
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('keydown', keyboard); document.removeEventListener('pointerdown', outsidePointer, true);
      scene.traverse(object => { object.geometry?.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material?.dispose()); });
      renderer.dispose(); canvas.remove();
    },
  };
  onReady({ available: true }); return api;
}
