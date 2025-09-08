/* 2048 3D using Three.js + tween.js
   - Core 2048 logic (4x4 grid)
   - 3D board & tile cubes with lighting and soft shadows
   - Animated slide/merge/spawn effects
   - Keyboard & touch swipe controls
*/

(() => {
  const setBoot = (msg) => { const el = document.getElementById('bootStatus'); if (el) el.textContent = msg; };
  setBoot('Booting…');
  if (typeof THREE === 'undefined' || typeof TWEEN === 'undefined') {
    setBoot('Missing libraries. Check network or CSP.');
    return;
  }
  setBoot('Libraries loaded. Initializing…');
  const GRID_SIZE = 4;
  const TILE_GAP = 0.2; // space between cubes
  const TILE_SIZE = 1;  // base cube size edge
  const BOARD_THICKNESS = 0.25;
  const ANIM_TIME = 140;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const newGameBtn = document.getElementById('newGame');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySubtitle = document.getElementById('overlaySubtitle');
  const tryAgainBtn = document.getElementById('tryAgain');

  // State
  let score = 0;
  let bestCache = 0;
  function getBest() {
    try { return Number(localStorage.getItem('best2048-3d') || '0'); } catch { return bestCache; }
  }
  function setBest(v) {
    bestCache = v;
    try { localStorage.setItem('best2048-3d', String(v)); } catch {}
  }
  let best = getBest();
  bestEl.textContent = best;

  // Grid as numbers, 0 for empty
  let grid = createEmptyGrid();
  // Map of tileId -> mesh & metadata
  const tiles = new Map();
  let nextId = 1;
  let isAnimating = false;

  // THREE basics
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    const msg = 'WebGL failed to initialize in this embedded browser. Please open in your system browser.';
    const el = document.getElementById('bootStatus'); if (el) el.textContent = msg; else alert(msg);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  setBoot('Renderer ready. Building scene…');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(4.2, 5.4, 6.4);
  camera.lookAt(0, 0, 0);
  const cameraDir = camera.position.clone().normalize();

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333355, 0.6);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(4, 6, 4);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 20;
  dir.shadow.camera.left = -6;
  dir.shadow.camera.right = 6;
  dir.shadow.camera.top = 6;
  dir.shadow.camera.bottom = -6;
  scene.add(dir);

  // Board base
  const boardSize = GRID_SIZE * TILE_SIZE + (GRID_SIZE - 1) * TILE_GAP;
  const boardGeo = new THREE.BoxGeometry(boardSize + 0.6, BOARD_THICKNESS, boardSize + 0.6);
  const boardMat = new THREE.MeshPhysicalMaterial({
    color: 0x111428,
    metalness: 0.2,
    roughness: 0.6,
    clearcoat: 0.3,
    clearcoatRoughness: 0.6
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.receiveShadow = true;
  board.position.y = -BOARD_THICKNESS / 2;
  scene.add(board);

  // Subtle fog-like background glow plane
  const glowGeo = new THREE.PlaneGeometry(40, 40);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x462b68, transparent: true, opacity: 0.15 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, -0.2, -4.5);
  glow.rotation.x = -Math.PI / 2.2;
  scene.add(glow);

  // Board grid markers (low, barely visible)
  const gridLines = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7e6bb5, transparent: true, opacity: 0.18 });
  for (let i = 0; i <= GRID_SIZE; i++) {
    const len = boardSize;
    const offset = -boardSize / 2 + i * (TILE_SIZE + TILE_GAP) - TILE_GAP / 2;
    // X lines
    gridLines.add(makeLine([-len / 2, 0.01, offset], [len / 2, 0.01, offset], lineMat));
    // Z lines
    gridLines.add(makeLine([offset, 0.01, -len / 2], [offset, 0.01, len / 2], lineMat));
  }
  scene.add(gridLines);

  function makeLine(a, b, mat) {
    const pts = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(g, mat);
  }

  // Tile materials/colors
  function colorFor(value) {
    const palette = {
      2: 0xd5d9ff,
      4: 0xbad1ff,
      8: 0x9ed0ff,
      16: 0x7cc2ff,
      32: 0x60b1ff,
      64: 0x49a0ff,
      128: 0xffb680,
      256: 0xffa45f,
      512: 0xff9040,
      1024: 0xff7a18,
      2048: 0xff5c5c,
    };
    return palette[value] || 0xffffff;
  }

  function makeTileMesh(value) {
    const geo = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE);
    // Add rounded feel via bevel-like normal tweak by scaling slightly and chamfer look using env
    const mat = new THREE.MeshPhysicalMaterial({
      color: colorFor(value),
      metalness: 0.1,
      roughness: 0.45,
      transmission: 0.0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    // Add floating text as sprite
  const label = makeTextSprite(String(value));
  // Lift label slightly above top surface to avoid clipping
  label.position.set(0, TILE_SIZE * 0.62, 0);
    mesh.add(label);
    mesh.userData.label = label;
    return mesh;
  }

  function updateTileVisual(tileMesh, value) {
    tileMesh.material.color.setHex(colorFor(value));
    const label = tileMesh.userData.label;
    if (label) updateTextSprite(label, String(value));
  }

  function makeTextSprite(text) {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#e2e8ff');
    ctx.fillStyle = gradient;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 110px Segoe UI, Arial';
    ctx.clearRect(0, 0, size, size);
    ctx.fillText(text, size / 2, size / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    const S = 0.95; // scale so it fits atop
    sprite.scale.set(S, S, 1);
    sprite.userData.canvas = canvas;
    sprite.userData.texture = texture;
  sprite.renderOrder = 10; // render above cubes
    return sprite;
  }

  function updateTextSprite(sprite, text) {
    const canvas = sprite.userData.canvas;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#e2e8ff');
    ctx.fillStyle = gradient;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 110px Segoe UI, Arial';
    ctx.clearRect(0, 0, size, size);
    ctx.fillText(text, size / 2, size / 2);
    sprite.userData.texture.needsUpdate = true;
  }

  // Coordinate helpers
  function cellToWorld(i, j) { // row i (z), col j (x)
    const x0 = -boardSize / 2 + TILE_SIZE / 2;
    const z0 = -boardSize / 2 + TILE_SIZE / 2;
    const x = x0 + j * (TILE_SIZE + TILE_GAP);
    const z = z0 + i * (TILE_SIZE + TILE_GAP);
    return new THREE.Vector3(x, TILE_SIZE / 2, z);
  }

  // Game core
  function createEmptyGrid() {
    return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  }

  function spawnRandom() {
    const empties = [];
    for (let i = 0; i < GRID_SIZE; i++)
      for (let j = 0; j < GRID_SIZE; j++)
        if (grid[i][j] === 0) empties.push([i, j]);
    if (empties.length === 0) return false;
    const [i, j] = empties[Math.floor(Math.random() * empties.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    grid[i][j] = value;
    const id = nextId++;
    const mesh = makeTileMesh(value);
    mesh.position.copy(cellToWorld(i, j));
    mesh.scale.set(0.01, 0.01, 0.01);
    scene.add(mesh);
    tiles.set(id, { id, i, j, value, mesh });

    // spawn animation
    new TWEEN.Tween(mesh.scale).to({ x: 1, y: 1, z: 1 }, 200).easing(TWEEN.Easing.Back.Out).start();
    pulse(mesh, 1.05, 160);
    return true;
  }

  function pulse(mesh, to = 1.06, duration = 140) {
    const s = { v: 1 };
    new TWEEN.Tween(s)
      .to({ v: to }, duration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .yoyo(true)
      .repeat(1)
      .onUpdate(() => mesh.scale.setScalar(s.v))
      .start();
  }

  function resetGame() {
    // remove meshes
    for (const { mesh } of tiles.values()) scene.remove(mesh);
    tiles.clear();
    grid = createEmptyGrid();
    score = 0;
    scoreEl.textContent = '0';
    overlay.hidden = true;
    spawnRandom();
    spawnRandom();
    updateAllTilePositionsInstant();
  }

  function updateAllTilePositionsInstant() {
    // rebuild tiles map from grid: find each tile mesh by matching position metadata
    // Here, we just ensure all tile meshes match their i,j positions.
    for (const t of tiles.values()) {
      t.mesh.position.copy(cellToWorld(t.i, t.j));
    }
  }

  function canMove() {
    // any empty
    for (let i = 0; i < GRID_SIZE; i++)
      for (let j = 0; j < GRID_SIZE; j++)
        if (grid[i][j] === 0) return true;
    // any mergeable neighbors
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const v = grid[i][j];
        if (i + 1 < GRID_SIZE && grid[i + 1][j] === v) return true;
        if (j + 1 < GRID_SIZE && grid[i][j + 1] === v) return true;
      }
    }
    return false;
  }

  // Move logic returns an animation plan
  function makeMove(dir) {
    // dir: 'left'|'right'|'up'|'down'
    const mergedEvents = [];

    const traverse = (cells) => {
      // Collect non-zero entries preserving order along the traversal line
      const entries = [];
      for (const [i, j] of cells) {
        const v = grid[i][j];
        if (v !== 0) entries.push({ pos: [i, j], value: v });
      }
      // Merge pass
      const merged = []; // items: { value, sources: [idx,..] }
      for (let k = 0; k < entries.length; k++) {
        if (k + 1 < entries.length && entries[k].value === entries[k + 1].value) {
          const newVal = entries[k].value * 2;
          merged.push({ value: newVal, sources: [k, k + 1] });
          score += newVal;
          k++; // skip next
        } else {
          merged.push({ value: entries[k].value, sources: [k] });
        }
      }
      // Apply results to grid, pad with zeros
      for (const [i, j] of cells) grid[i][j] = 0;
      for (let idx = 0; idx < cells.length; idx++) {
        const [ti, tj] = cells[idx];
        if (idx < merged.length) {
          const m = merged[idx];
          grid[ti][tj] = m.value;
          const sources = m.sources.map(si => entries[si].pos);
          mergedEvents.push({ target: [ti, tj], value: m.value, sources });
        } else {
          // remains zero
        }
      }
    };

    if (dir === 'left' || dir === 'right') {
      for (let i = 0; i < GRID_SIZE; i++) {
        const cells = [];
        for (let j = 0; j < GRID_SIZE; j++) cells.push([i, j]);
        if (dir === 'right') cells.reverse();
        traverse(cells);
      }
    } else {
      for (let j = 0; j < GRID_SIZE; j++) {
        const cells = [];
        for (let i = 0; i < GRID_SIZE; i++) cells.push([i, j]);
        if (dir === 'down') cells.reverse();
        traverse(cells);
      }
    }

    // Build animation plan from mergedEvents by relocating existing tile meshes to new positions, merging duplicates
    // We need to map meshes: for each target, find which existing tiles should move there; if >1, merge and remove extras
    const usedSources = new Set();
    const moves = [];
    for (const evt of mergedEvents) {
      const [ti, tj] = evt.target;
      const targetPos = cellToWorld(ti, tj);
      const srcTiles = [];
      for (const [si, sj] of evt.sources) {
        const t = findTileAt(si, sj, usedSources);
        if (t) { srcTiles.push(t); usedSources.add(t.id); }
      }
      if (srcTiles.length === 1) {
        // single move
        const t = srcTiles[0];
        moves.push({ type: 'move', tile: t, toI: ti, toJ: tj, toPos: targetPos, newValue: evt.value, merge: false });
      } else if (srcTiles.length >= 2) {
        // merge: pick one as primary, others merge into it
        const primary = srcTiles[0];
        const rest = srcTiles.slice(1);
        moves.push({ type: 'merge', primary, rest, toI: ti, toJ: tj, toPos: targetPos, newValue: evt.value });
      }
    }

    // Detect if any actual movement happened by checking changed positions or merges (avoid optional chaining for older browsers)
    let anyMove = false;
    for (let idx = 0; idx < moves.length; idx++) {
      const m = moves[idx];
      if (m.type === 'merge') { anyMove = true; break; }
      if (m.type === 'move') {
        if (m.tile && (m.tile.i !== m.toI || m.tile.j !== m.toJ)) { anyMove = true; break; }
      }
    }
    return { anyMove, moves };
  }

  function findTileAt(i, j, excludeSet = new Set()) {
    for (const t of tiles.values()) {
      if (!excludeSet.has(t.id) && t.i === i && t.j === j) return t;
    }
    return null;
  }

  function animateMoves(plan) {
    if (!plan.anyMove) return Promise.resolve();
    return new Promise((resolve) => {
      let active = 0;
      const done = () => { if (--active === 0) resolve(); };
      for (const mv of plan.moves) {
        if (mv.type === 'move') {
          active++;
          const { tile, toI, toJ, toPos, newValue } = mv;
          tile.i = toI; tile.j = toJ; tile.value = newValue;
          // tween position
          new TWEEN.Tween(tile.mesh.position)
            .to({ x: toPos.x, y: toPos.y, z: toPos.z }, ANIM_TIME)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
              updateTileVisual(tile.mesh, tile.value);
              done();
            })
            .start();
        } else if (mv.type === 'merge') {
          active++;
          const { primary, rest, toI, toJ, toPos, newValue } = mv;
          // move all to target, then remove rest and update primary value
          let innerActive = rest.length + 1;
          const innerDone = () => {
            if (--innerActive === 0) {
              // remove merged tiles
              for (const r of rest) {
                scene.remove(r.mesh);
                tiles.delete(r.id);
              }
              // update primary
              primary.i = toI; primary.j = toJ; primary.value = newValue;
              updateTileVisual(primary.mesh, primary.value);
              pulse(primary.mesh, 1.12, 160);
              active--; if (active === 0) resolve();
            }
          };
          // move primary
          new TWEEN.Tween(primary.mesh.position)
            .to({ x: toPos.x, y: toPos.y, z: toPos.z }, ANIM_TIME)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(innerDone)
            .start();
          // move rest to target, then shrink and remove handled above
          for (const r of rest) {
            new TWEEN.Tween(r.mesh.position)
              .to({ x: toPos.x, y: toPos.y, z: toPos.z }, ANIM_TIME)
              .easing(TWEEN.Easing.Quadratic.Out)
              .onComplete(innerDone)
              .start();
          }
        }
      }
    });
  }

  function afterMove() {
    scoreEl.textContent = String(score);
  if (score > best) { best = score; bestEl.textContent = String(best); setBest(best); }
    const spawned = spawnRandom();
    if (!spawned && !canMove()) {
      overlayTitle.textContent = 'Game Over';
      overlaySubtitle.textContent = 'No more moves available';
      overlay.hidden = false;
    }
  }

  function checkGameOverIfNoChange() {
    // If the board is full and no merges are possible, show overlay
    if (!canMove()) {
      overlayTitle.textContent = 'Game Over';
      overlaySubtitle.textContent = 'No more moves available';
      overlay.hidden = false;
    }
  }

  // Input
  window.addEventListener('keydown', (e) => {
  if (isAnimating) return;
    const key = e.key.toLowerCase();
    let dir = null;
    if (key === 'arrowleft' || key === 'a') dir = 'left';
    else if (key === 'arrowright' || key === 'd') dir = 'right';
    else if (key === 'arrowup' || key === 'w') dir = 'up';
    else if (key === 'arrowdown' || key === 's') dir = 'down';
    if (!dir) return;
    const plan = makeMove(dir);
    if (plan.anyMove) {
      isAnimating = true;
      animateMoves(plan).then(() => { afterMove(); isAnimating = false; });
    } else {
      // No tiles moved; check if truly no moves remain and notify
      checkGameOverIfNoChange();
    }
  });

  // Touch swipe
  let touchStart = null;
  window.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
  if (isAnimating) return;
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.hypot(dx, dy) < 24) return;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const dir = horizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  const plan = makeMove(dir);
  if (plan.anyMove) { isAnimating = true; animateMoves(plan).then(() => { afterMove(); isAnimating = false; }); }
  else { checkGameOverIfNoChange(); }
  }, { passive: true });

  // UI buttons
  newGameBtn.addEventListener('click', resetGame);
  tryAgainBtn.addEventListener('click', resetGame);

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  fitCameraToBoard();
  });

  // Fit camera so the entire board is visible on any device
  function fitCameraToBoard() {
    // approximate board bounding sphere radius (diagonal of square)
    const radius = Math.SQRT2 * (boardSize / 2) * 1.12; // add margin
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distV = radius / Math.sin(vFov / 2);
    const distH = radius / Math.sin(hFov / 2);
    const dist = Math.max(distV, distH);
    const minDist = 4.5; // prevent getting too close on tiny screens
    const finalDist = Math.max(dist, minDist);
    const dir = cameraDir.clone().normalize();
    camera.position.copy(dir.multiplyScalar(finalDist));
    camera.near = Math.max(0.1, finalDist - radius * 2);
    camera.far = finalDist + radius * 6;
    camera.updateProjectionMatrix();
  }

  // Static camera; standard render loop
  function animate(time) {
    camera.lookAt(0, 0.1, 0);
    TWEEN.update(time);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // Start
  resetGame();
  fitCameraToBoard();
  requestAnimationFrame(animate);
  setBoot('Ready');
})();
