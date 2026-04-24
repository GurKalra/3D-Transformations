import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// UI ELEMENTS
// ============================================
const viewportContainer = document.getElementById('viewport-container');
const winOverlay = document.getElementById('win-overlay');

const sliders = {
    t: { x: document.getElementById('tx'), y: document.getElementById('ty'), z: document.getElementById('tz') },
    r: { x: document.getElementById('rx'), y: document.getElementById('ry'), z: document.getElementById('rz') },
    s: { x: document.getElementById('sx'), y: document.getElementById('sy'), z: document.getElementById('sz') }
};
const vals = {
    t: { x: document.getElementById('val-tx'), y: document.getElementById('val-ty'), z: document.getElementById('val-tz') },
    r: { x: document.getElementById('val-rx'), y: document.getElementById('val-ry'), z: document.getElementById('val-rz') },
    s: { x: document.getElementById('val-sx'), y: document.getElementById('val-sy'), z: document.getElementById('val-sz') }
};

const matrixContainers = {
    initial: document.getElementById('matrix-initial'),
    target: document.getElementById('matrix-target'),
    t: document.getElementById('matrix-t'),
    r: document.getElementById('matrix-r'),
    s: document.getElementById('matrix-s'),
    composite: document.getElementById('matrix-composite')
};

const levelSelect = document.getElementById('level-select');
const btnToggleAxes = document.getElementById('btn-toggle-axes');
const btnReset = document.getElementById('btn-reset');
const coordX = document.getElementById('coord-x');
const coordY = document.getElementById('coord-y');
const coordZ = document.getElementById('coord-z');
const hudLevel = document.getElementById('hud-level');
const hudScoreVal = document.getElementById('hud-score-val');
const hudStreakVal = document.getElementById('hud-streak-val');

// ============================================
// THREE.JS MAIN SCENE SETUP
// ============================================
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(50, viewportContainer.clientWidth / viewportContainer.clientHeight, 0.1, 100);
camera.position.set(5, 5, 10);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(viewportContainer.clientWidth, viewportContainer.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
viewportContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;
controls.saveState();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(20, 20, 0xcccccc, 0xeeeeee);
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(2);
axesHelper.visible = false;

// ============================================
// GAME OBJECTS
// ============================================
const geometry = new THREE.BoxGeometry(1, 1, 1);

const originalPlayerMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
    new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
    new THREE.MeshStandardMaterial({ color: 0x0000ff }),
    new THREE.MeshStandardMaterial({ color: 0xffff00 }),
    new THREE.MeshStandardMaterial({ color: 0x00ffff }),
    new THREE.MeshStandardMaterial({ color: 0xff00ff })
];
const winMaterial = new THREE.MeshStandardMaterial({
    color: 0x8bcead, emissive: 0x8bcead, emissiveIntensity: 0.5
});

const player = new THREE.Mesh(geometry, originalPlayerMaterials);
player.add(axesHelper);
scene.add(player);

const targetMaterial = new THREE.MeshStandardMaterial({
    color: 0x8bcead, wireframe: true, transparent: true, opacity: 0.5
});
const target = new THREE.Mesh(geometry, targetMaterial);
scene.add(target);

// Target glow
const glowGeo = new THREE.BoxGeometry(1.08, 1.08, 1.08);
const glowMat = new THREE.MeshBasicMaterial({
    color: 0x8bcead, wireframe: true, transparent: true, opacity: 0.2
});
const targetGlow = new THREE.Mesh(glowGeo, glowMat);
target.add(targetGlow);

// ============================================
// GAME STATE
// ============================================
let currentLevel = 1;
let levelWon = false;
let initialMatrix = new THREE.Matrix4();
let targetMatrix = new THREE.Matrix4();
let initT = { x: 0, y: 0, z: 0 };
let initR = { x: 0, y: 0, z: 0 };
let initS = { x: 1, y: 1, z: 1 };
let score = 0;
let streak = 0;
let previousCellValues = {};

// ============================================
// MATRIX DISPLAY (UPGRADED — DIV GRID CELLS)
// ============================================
function formatMatrixCells(matrixElements, colorType, targetElements) {
    let html = '';
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const index = col * 4 + row;
            const val = matrixElements[index];
            let cls = 'm-cell';

            if (colorType === 'translation' && (index === 12 || index === 13 || index === 14)) {
                cls += ' cell-translation';
            } else if (colorType === 'rotation' && [0,1,2,4,5,6,8,9,10].includes(index)) {
                cls += ' cell-rotation';
            } else if (colorType === 'scale' && (index === 0 || index === 5 || index === 10)) {
                cls += ' cell-scale';
            }

            if (targetElements) {
                const diff = Math.abs(val - targetElements[index]);
                if (diff <= 0.05) cls += ' match-close';
                else if (diff > 2.0) cls += ' match-far';
            }

            const cellKey = colorType + '_' + index;
            const prevVal = previousCellValues[cellKey];
            if (prevVal !== undefined && Math.abs(prevVal - val) > 0.001) {
                cls += ' cell-flash';
            }
            previousCellValues[cellKey] = val;

            html += `<div class="${cls}">${val.toFixed(2)}</div>`;
        }
    }
    return html;
}

// ============================================
// CORE GAME LOGIC (PRESERVED)
// ============================================
function updatePlayerFromSliders() {
    if (levelWon) return;

    const tx = parseFloat(sliders.t.x.value);
    const ty = parseFloat(sliders.t.y.value);
    const tz = parseFloat(sliders.t.z.value);
    const rx = parseFloat(sliders.r.x.value);
    const ry = parseFloat(sliders.r.y.value);
    const rz = parseFloat(sliders.r.z.value);
    const sx = parseFloat(sliders.s.x.value);
    const sy = parseFloat(sliders.s.y.value);
    const sz = parseFloat(sliders.s.z.value);

    player.position.set(tx, ty, tz);
    player.rotation.set(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz)
    );
    player.scale.set(sx, sy, sz);

    vals.t.x.textContent = tx.toFixed(1);
    vals.t.y.textContent = ty.toFixed(1);
    vals.t.z.textContent = tz.toFixed(1);
    vals.r.x.textContent = rx;
    vals.r.y.textContent = ry;
    vals.r.z.textContent = rz;
    vals.s.x.textContent = sx.toFixed(1);
    vals.s.y.textContent = sy.toFixed(1);
    vals.s.z.textContent = sz.toFixed(1);

    coordX.textContent = tx.toFixed(1);
    coordY.textContent = ty.toFixed(1);
    coordZ.textContent = tz.toFixed(1);

    player.updateMatrix();
    updateLiveMatricesHTML(tx, ty, tz, rx, ry, rz, sx, sy, sz);
}

function updateLiveMatricesHTML(tx, ty, tz, rx, ry, rz, sx, sy, sz) {
    document.getElementById('eq-t').innerHTML = `<code>P' = P + [${tx.toFixed(1)}, ${ty.toFixed(1)}, ${tz.toFixed(1)}]</code>`;
    document.getElementById('eq-r').innerHTML = `<code>P' = Rot(${rx}°, ${ry}°, ${rz}°) × P</code>`;
    document.getElementById('eq-s').innerHTML = `<code>P' = [${sx.toFixed(1)}x, ${sy.toFixed(1)}y, ${sz.toFixed(1)}z]</code>`;

    const matT = new THREE.Matrix4().makeTranslation(tx, ty, tz);
    matrixContainers.t.innerHTML = formatMatrixCells(matT.elements, 'translation');

    const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz)
    );
    const matR = new THREE.Matrix4().makeRotationFromEuler(euler);
    matrixContainers.r.innerHTML = formatMatrixCells(matR.elements, 'rotation');

    const matS = new THREE.Matrix4().makeScale(sx, sy, sz);
    matrixContainers.s.innerHTML = formatMatrixCells(matS.elements, 'scale');

    matrixContainers.composite.innerHTML = formatMatrixCells(player.matrix.elements, 'composite', targetMatrix.elements);
}

function randomVal(min, max, step) {
    const steps = Math.floor((max - min) / step);
    const randStep = Math.floor(Math.random() * (steps + 1));
    return min + randStep * step;
}

function loadLevel(level) {
    currentLevel = level;
    levelWon = false;
    winOverlay.classList.add('hidden');
    player.material = originalPlayerMaterials;

    hudLevel.textContent = `LEVEL 0${level} / 04`;

    let targetT = { x: 0, y: 0, z: 0 };
    let targetR = { x: 0, y: 0, z: 0 };
    let targetS = { x: 1, y: 1, z: 1 };
    initT = { x: 0, y: 0, z: 0 };
    initR = { x: 0, y: 0, z: 0 };
    initS = { x: 1, y: 1, z: 1 };

    Object.values(sliders).forEach(group => {
        Object.values(group).forEach(slider => slider.disabled = false);
    });

    if (level == 1) {
        targetT = { x: randomVal(-4, 4, 1), y: randomVal(-4, 4, 1), z: randomVal(-4, 4, 1) };
        disableSliders(sliders.r);
        disableSliders(sliders.s);
    } else if (level == 2) {
        targetT = { x: randomVal(-4, 4, 1), y: randomVal(-4, 4, 1), z: randomVal(-4, 4, 1) };
        targetS = { x: randomVal(0.5, 2.5, 0.5), y: randomVal(0.5, 2.5, 0.5), z: randomVal(0.5, 2.5, 0.5) };
        disableSliders(sliders.r);
    } else if (level == 3) {
        targetR = { x: randomVal(0, 315, 45), y: randomVal(0, 315, 45), z: randomVal(0, 315, 45) };
        disableSliders(sliders.t);
        disableSliders(sliders.s);
    } else if (level == 4) {
        targetT = { x: randomVal(-3, 3, 1), y: randomVal(-3, 3, 1), z: randomVal(-3, 3, 1) };
        targetR = { x: randomVal(0, 315, 45), y: randomVal(0, 315, 45), z: randomVal(0, 315, 45) };
        targetS = { x: randomVal(0.5, 2, 0.5), y: randomVal(0.5, 2, 0.5), z: randomVal(0.5, 2, 0.5) };
        initT = { x: randomVal(-3, 3, 1), y: randomVal(-3, 3, 1), z: randomVal(-3, 3, 1) };
        initR = { x: randomVal(0, 315, 45), y: randomVal(0, 315, 45), z: randomVal(0, 315, 45) };
        initS = { x: randomVal(0.5, 2, 0.5), y: randomVal(0.5, 2, 0.5), z: randomVal(0.5, 2, 0.5) };
    }

    if (JSON.stringify(targetT) === JSON.stringify(initT) &&
        JSON.stringify(targetR) === JSON.stringify(initR) &&
        JSON.stringify(targetS) === JSON.stringify(initS)) {
        targetT.x += 1;
    }

    target.position.set(targetT.x, targetT.y, targetT.z);
    target.rotation.set(
        THREE.MathUtils.degToRad(targetR.x),
        THREE.MathUtils.degToRad(targetR.y),
        THREE.MathUtils.degToRad(targetR.z)
    );
    target.scale.set(targetS.x, targetS.y, targetS.z);
    target.updateMatrix();

    targetMatrix.copy(target.matrix);
    matrixContainers.target.innerHTML = formatMatrixCells(targetMatrix.elements, 'none');

    sliders.t.x.value = initT.x; sliders.t.y.value = initT.y; sliders.t.z.value = initT.z;
    sliders.r.x.value = initR.x; sliders.r.y.value = initR.y; sliders.r.z.value = initR.z;
    sliders.s.x.value = initS.x; sliders.s.y.value = initS.y; sliders.s.z.value = initS.z;

    updatePlayerFromSliders();

    initialMatrix.copy(player.matrix);
    matrixContainers.initial.innerHTML = formatMatrixCells(initialMatrix.elements, 'none');
}

function disableSliders(sliderGroup) {
    Object.values(sliderGroup).forEach(slider => slider.disabled = true);
}

// ============================================
// WIN CONDITION + PARTICLES
// ============================================
let particles = [];
const particleCanvas = document.getElementById('particle-canvas');
const pCtx = particleCanvas ? particleCanvas.getContext('2d') : null;

function spawnParticles() {
    if (!particleCanvas || !pCtx) return;
    particleCanvas.width = viewportContainer.clientWidth;
    particleCanvas.height = viewportContainer.clientHeight;
    particles = [];
    for (let i = 0; i < 60; i++) {
        particles.push({
            x: particleCanvas.width / 2,
            y: particleCanvas.height / 2,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            life: 1,
            size: Math.random() * 5 + 2,
            color: ['#8bcead', '#8bb8e8', '#b0a4d4', '#e8a0b4'][Math.floor(Math.random() * 4)]
        });
    }
}

function updateParticles() {
    if (!pCtx || particles.length === 0) return;
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 0.015;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        pCtx.globalAlpha = p.life;
        pCtx.fillStyle = p.color;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        pCtx.fill();
    }
}

function checkWinCondition() {
    if (levelWon) return;

    player.updateMatrix();
    const pMat = player.matrix.elements;
    const tMat = target.matrix.elements;

    let isMatch = true;
    for (let i = 0; i < 16; i++) {
        if (Math.abs(pMat[i] - tMat[i]) > 0.15) {
            isMatch = false;
            break;
        }
    }

    if (isMatch) {
        levelWon = true;

        player.position.copy(target.position);
        player.rotation.copy(target.rotation);
        player.scale.copy(target.scale);
        player.updateMatrix();

        updatePlayerFromSliders();
        player.material = winMaterial;
        winOverlay.classList.remove('hidden');
        winOverlay.classList.add('flash');
        setTimeout(() => winOverlay.classList.remove('flash'), 400);

        score += (currentLevel * 100);
        streak++;
        hudScoreVal.textContent = score;
        hudStreakVal.textContent = streak;

        spawnParticles();

        setTimeout(() => {
            let nextLevel = currentLevel < 4 ? currentLevel + 1 : 1;
            levelSelect.value = nextLevel.toString();
            loadLevel(nextLevel);
        }, 3000);
    }
}

// ============================================
// CUSTOM 3D CURSOR
// ============================================
const cursorCanvas = document.getElementById('cursor-canvas');
let cursorRenderer, cursorScene, cursorCamera, cursorCube, cursorMat;
let cursorSpeed = 0.02;
let cursorX = -100, cursorY = -100;
let cursorScale = 2.5; // Starts larger in hero section

const sectionColors = {
    hero: 0x4a7ab5,
    theory: 0x4a7ab5,
    playground: 0xc94767,
    'matrix-math': 0x725bb3
};
let activeSection = 'hero';

try {
    cursorRenderer = new THREE.WebGLRenderer({ canvas: cursorCanvas, alpha: true, antialias: true });
    cursorRenderer.setSize(60, 60);
    cursorRenderer.setPixelRatio(1);

    cursorScene = new THREE.Scene();
    cursorCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    cursorCamera.position.z = 2.8;

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    cursorMat = new THREE.LineBasicMaterial({ color: sectionColors.hero });
    cursorCube = new THREE.LineSegments(edges, cursorMat);
    cursorScene.add(cursorCube);
} catch (e) {
    console.warn('Cursor renderer failed:', e);
}

document.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
    if (cursorCanvas) {
        cursorCanvas.style.left = cursorX + 'px';
        cursorCanvas.style.top = cursorY + 'px';
        cursorCanvas.style.transform = `translate(-50%, -50%) scale(${cursorScale})`;
    }
});

document.addEventListener('mouseover', (e) => {
    const el = e.target;
    if (el.matches('button, input, select, a, .theory-option, .theory-option *')) {
        cursorSpeed = 0.08;
    } else {
        cursorSpeed = 0.02;
    }
});

// ============================================
// HERO THREE.JS SCENE
// ============================================
const heroCanvas = document.getElementById('hero-canvas');
const heroSection = document.getElementById('hero');
let heroRenderer, heroScene, heroCamera;
let heroShapes = [];
let heroCube = null;
let heroMouseX = 0, heroMouseY = 0;

if (heroCanvas && heroSection) {
    heroScene = new THREE.Scene();
    heroCamera = new THREE.PerspectiveCamera(60, heroSection.clientWidth / heroSection.clientHeight, 0.1, 100);
    heroCamera.position.z = 8;

    heroRenderer = new THREE.WebGLRenderer({ canvas: heroCanvas, alpha: true, antialias: true });
    heroRenderer.setSize(heroSection.clientWidth, heroSection.clientHeight);
    heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Giant central wireframe cube
    const bigEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.5, 3.5, 3.5));
    const bigMat = new THREE.LineBasicMaterial({ color: 0x4a7ab5, transparent: true, opacity: 0.8 });
    heroCube = new THREE.LineSegments(bigEdges, bigMat);
    heroScene.add(heroCube);

    // Floating wireframe shapes at different depths (using darker variants for light mode visibility)
    const shapes = [
        { geo: new THREE.EdgesGeometry(new THREE.BoxGeometry(0.8, 0.8, 0.8)), pos: [-4, 2, -2], color: 0x4a7ab5 },
        { geo: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.6, 0)), pos: [4.5, -1.5, -3], color: 0xc94767 },
        { geo: new THREE.EdgesGeometry(new THREE.TorusGeometry(0.5, 0.2, 8, 12)), pos: [-3, -2.5, -1], color: 0x725bb3 },
        { geo: new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.5, 0)), pos: [3, 2.5, -4], color: 0xc94767 },
        { geo: new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5)), pos: [-5, 0, -5], color: 0x4a7ab5 },
        { geo: new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(0.5, 0)), pos: [5, -3, -2], color: 0x725bb3 },
    ];

    shapes.forEach(s => {
        const mat = new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 1.0 });
        const mesh = new THREE.LineSegments(s.geo, mat);
        mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
        heroScene.add(mesh);
        heroShapes.push({ mesh, basePos: [...s.pos], rotSpeed: [Math.random() * 0.01 + 0.003, Math.random() * 0.01 + 0.003] });
    });

    // Track mouse for parallax
    document.addEventListener('mousemove', (e) => {
        heroMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        heroMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    // Resize
    window.addEventListener('resize', () => {
        if (heroRenderer && heroSection) {
            heroCamera.aspect = heroSection.clientWidth / heroSection.clientHeight;
            heroCamera.updateProjectionMatrix();
            heroRenderer.setSize(heroSection.clientWidth, heroSection.clientHeight);
        }
    });
}

// ============================================
// SCROLL PROGRESS + NAVBAR
// ============================================
const scrollProgress = document.getElementById('scroll-progress');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (scrollProgress) scrollProgress.style.width = pct + '%';

    if (heroSection) {
        const heroRect = heroSection.getBoundingClientRect();
        // scrollProg goes from 0 at top to 1 when scrolled past
        const scrollProg = Math.max(0, Math.min(1, -heroRect.top / heroRect.height));
        cursorScale = 2.5 - scrollProg * 1.5; // Starts at 2.5, shrinks to 1
        
        if (cursorCanvas) {
            cursorCanvas.style.transform = `translate(-50%, -50%) scale(${cursorScale})`;
        }
        
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            // Text goes up and fades out
            heroContent.style.transform = `translateY(${-scrollTop * 0.5}px) scale(${1 - scrollProg * 0.2})`;
            heroContent.style.opacity = 1 - scrollProg * 1.5;
        }

        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (scrollProg > 0.3) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    }
});

const sectionIds = ['hero', 'theory', 'playground', 'matrix-math'];
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            activeSection = entry.target.id;
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('data-section') === activeSection);
            });
            if (cursorMat && sectionColors[activeSection]) {
                cursorMat.color.setHex(sectionColors[activeSection]);
            }
        }
    });
}, { threshold: 0.3 });

sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
});

// ============================================
// THEORY SECTION (LEFT SELECTOR + RIGHT CONTENT)
// ============================================
const theoryOptions = document.querySelectorAll('.theory-option');
const theoryTitle = document.getElementById('theory-title');
const theoryDesc = document.getElementById('theory-desc');
const theoryEquation = document.getElementById('theory-equation');
const theoryMatrixDisplay = document.getElementById('theory-matrix-display');
const theoryPreviewCanvas = document.getElementById('theory-preview-canvas');

const theoryData = {
    translation: {
        title: 'Translation',
        desc: 'Translation moves an object in 3D space along the X, Y, or Z axes without altering its rotation or size. It is the simplest transformation — just adding an offset vector to every point.',
        equation: "P' = P + T",
        matrixFn: () => new THREE.Matrix4().makeTranslation(2, 1, -1),
        highlights: [12, 13, 14]
    },
    rotation: {
        title: 'Rotation',
        desc: "Rotation pivots an object around a specific axis (X, Y, or Z) by a given angle θ. The rotation matrix uses sine and cosine to map points to their new positions on a circular path.",
        equation: "x' = x·cos(θ) − y·sin(θ)\ny' = x·sin(θ) + y·cos(θ)",
        matrixFn: () => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.PI / 4, 0)),
        highlights: [0,1,2,4,5,6,8,9,10]
    },
    scaling: {
        title: 'Scaling',
        desc: 'Scaling resizes an object along the X, Y, or Z axes independently. A scale factor greater than 1 enlarges the object, while a factor less than 1 shrinks it. Uniform scaling uses the same factor for all axes.',
        equation: "P' = S · P",
        matrixFn: () => new THREE.Matrix4().makeScale(2, 1.5, 0.5),
        highlights: [0, 5, 10]
    }
};

let currentTheoryType = 'translation';
let theoryPreviewScene = null;

function initTheoryPreview() {
    if (!theoryPreviewCanvas) return;
    const s = new THREE.Scene();
    s.background = new THREE.Color(0xf0f4f8);
    const cam = new THREE.PerspectiveCamera(50, theoryPreviewCanvas.width / theoryPreviewCanvas.height, 0.1, 50);
    cam.position.set(2.5, 2, 4);
    cam.lookAt(0, 0, 0);

    const r = new THREE.WebGLRenderer({ canvas: theoryPreviewCanvas, antialias: true });
    r.setSize(theoryPreviewCanvas.clientWidth, theoryPreviewCanvas.clientHeight);

    s.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl = new THREE.DirectionalLight(0xffffff, 0.7);
    dl.position.set(5, 5, 5);
    s.add(dl);
    s.add(new THREE.GridHelper(6, 6, 0xcccccc, 0xdddddd));

    const mat = new THREE.MeshStandardMaterial({ color: 0x8bb8e8 });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat);
    s.add(cube);

    theoryPreviewScene = { scene: s, camera: cam, renderer: r, cube };
}

function renderTheoryMatrix(type) {
    if (!theoryMatrixDisplay) return;
    const data = theoryData[type];
    const mat4 = data.matrixFn();
    let html = '';
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const idx = col * 4 + row;
            const cls = data.highlights.includes(idx) ? 'm-cell highlight' : 'm-cell';
            html += `<div class="${cls}">${mat4.elements[idx].toFixed(2)}</div>`;
        }
    }
    theoryMatrixDisplay.innerHTML = html;
}

function selectTheory(type) {
    currentTheoryType = type;
    const data = theoryData[type];

    theoryOptions.forEach(opt => {
        opt.classList.toggle('active', opt.getAttribute('data-type') === type);
    });

    if (theoryTitle) theoryTitle.textContent = data.title;
    if (theoryDesc) theoryDesc.textContent = data.desc;
    if (theoryEquation) theoryEquation.textContent = data.equation;
    renderTheoryMatrix(type);

    // Reset preview cube
    if (theoryPreviewScene) {
        theoryPreviewScene.cube.position.set(0, 0, 0);
        theoryPreviewScene.cube.rotation.set(0, 0, 0);
        theoryPreviewScene.cube.scale.set(1, 1, 1);
    }
}

theoryOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        selectTheory(opt.getAttribute('data-type'));
    });
});




// ============================================
// EVENT LISTENERS (PRESERVED)
// ============================================
Object.values(sliders).forEach(group => {
    Object.values(group).forEach(slider => {
        slider.addEventListener('input', updatePlayerFromSliders);
    });
});

levelSelect.addEventListener('change', (e) => {
    loadLevel(parseInt(e.target.value));
});

btnReset.addEventListener('click', () => {
    if (levelWon) return;
    sliders.t.x.value = initT.x; sliders.t.y.value = initT.y; sliders.t.z.value = initT.z;
    sliders.r.x.value = initR.x; sliders.r.y.value = initR.y; sliders.r.z.value = initR.z;
    sliders.s.x.value = initS.x; sliders.s.y.value = initS.y; sliders.s.z.value = initS.z;
    updatePlayerFromSliders();
    controls.reset();
    camera.position.set(5, 5, 10);
    controls.target.set(0, 0, 0);
    controls.update();
});

btnToggleAxes.addEventListener('click', () => {
    axesHelper.visible = !axesHelper.visible;
    btnToggleAxes.textContent = axesHelper.visible ? "Hide Axes" : "Show Axes";
});

window.addEventListener('resize', () => {
    camera.aspect = viewportContainer.clientWidth / viewportContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewportContainer.clientWidth, viewportContainer.clientHeight);
});

// ============================================
// ANIMATION LOOP
// ============================================
let clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    controls.update();
    checkWinCondition();

    // Target glow pulse
    if (glowMat && !levelWon) {
        glowMat.opacity = 0.15 + 0.1 * Math.sin(t * 3);
        targetMaterial.opacity = 0.4 + 0.15 * Math.sin(t * 2.5);
    }

    // Particles
    updateParticles();

    // Main render
    renderer.render(scene, camera);

    // Cursor render
    if (cursorCube && cursorRenderer) {
        cursorCube.rotation.x += cursorSpeed;
        cursorCube.rotation.y += cursorSpeed * 1.3;
        cursorRenderer.render(cursorScene, cursorCamera);
    }

    // Hero scene — floating wireframes + giant cube
    if (heroRenderer && heroCube) {
        // Scroll progress for hero (0 at top, 1 when hero scrolled away)
        const heroRect = heroSection.getBoundingClientRect();
        const scrollProg = Math.max(0, Math.min(1, -heroRect.top / heroRect.height));

        // Giant cube: slow rotation + mouse influence
        heroCube.rotation.x = t * 0.15 + heroMouseY * 0.3;
        heroCube.rotation.y = t * 0.2 + heroMouseX * 0.3;

        // Scroll: scale up and move up
        const cubeScale = 1 + scrollProg * 1.5;
        heroCube.scale.set(cubeScale, cubeScale, cubeScale);
        heroCube.position.y = scrollProg * 2;
        heroCube.material.opacity = 0.8 * (1 - scrollProg * 0.5);

        // Floating shapes: rotate + mouse parallax
        heroShapes.forEach(s => {
            s.mesh.rotation.x += s.rotSpeed[0];
            s.mesh.rotation.y += s.rotSpeed[1];
            // Mouse parallax — closer objects move more
            const depth = Math.abs(s.basePos[2]) + 1;
            const parallaxStr = 0.15 / depth;
            s.mesh.position.x = s.basePos[0] + heroMouseX * parallaxStr * 5;
            s.mesh.position.y = s.basePos[1] - heroMouseY * parallaxStr * 5;
            
            // Scale up on scroll
            const shapeScale = 1 + scrollProg * 2;
            s.mesh.scale.set(shapeScale, shapeScale, shapeScale);
        });

        heroRenderer.render(heroScene, heroCamera);
    }

    // Theory preview scene
    if (theoryPreviewScene) {
        const cube = theoryPreviewScene.cube;
        if (currentTheoryType === 'translation') {
            cube.position.x = Math.sin(t * 1.5) * 1.5;
            cube.position.y = Math.abs(Math.sin(t * 2)) * 0.5;
        } else if (currentTheoryType === 'rotation') {
            cube.rotation.x = t * 0.8;
            cube.rotation.y = t * 1.2;
        } else {
            const s = 0.6 + 0.5 * Math.sin(t * 1.2);
            cube.scale.set(s, s, s);
        }
        theoryPreviewScene.renderer.render(theoryPreviewScene.scene, theoryPreviewScene.camera);
    }
}

// ============================================
// INIT
// ============================================
initTheoryPreview();
selectTheory('translation');
loadLevel(1);
animate();

