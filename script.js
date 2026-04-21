import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- UI Elements ---
const viewportContainer = document.getElementById('viewport-container');
const winOverlay = document.getElementById('win-overlay');

// Sliders and Values
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

// Matrices HTML Tables
const tables = {
    initial: document.getElementById('matrix-initial'),
    target: document.getElementById('matrix-target'),
    t: document.getElementById('matrix-t'),
    r: document.getElementById('matrix-r'),
    s: document.getElementById('matrix-s'),
    composite: document.getElementById('matrix-composite')
};

// Buttons and other controls
const levelSelect = document.getElementById('level-select');
const btnToggleAxes = document.getElementById('btn-toggle-axes');
const btnReset = document.getElementById('btn-reset');

// Coordinate Overlay
const coordX = document.getElementById('coord-x');
const coordY = document.getElementById('coord-y');
const coordZ = document.getElementById('coord-z');

// Theory Elements
const btnTranslation = document.getElementById('btn-translation');
const btnRotation = document.getElementById('btn-rotation');
const btnScaling = document.getElementById('btn-scaling');
const theoryContent = document.getElementById('theory-content');

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = null; // Transparent background to let CSS show through

const camera = new THREE.PerspectiveCamera(50, viewportContainer.clientWidth / viewportContainer.clientHeight, 0.1, 100);
camera.position.set(5, 5, 10);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(viewportContainer.clientWidth, viewportContainer.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
viewportContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false; // Disabled zoom to fix trackpad sensitivity issues
controls.saveState(); // Save initial state for reset

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Helpers
const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(2);
axesHelper.visible = false; // Hidden by default

// --- Objects ---
const geometry = new THREE.BoxGeometry(1, 1, 1);

// Player Multi-Material Box
const originalPlayerMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xff0000 }), // Red
    new THREE.MeshStandardMaterial({ color: 0x00ff00 }), // Green
    new THREE.MeshStandardMaterial({ color: 0x0000ff }), // Blue
    new THREE.MeshStandardMaterial({ color: 0xffff00 }), // Yellow
    new THREE.MeshStandardMaterial({ color: 0x00ffff }), // Cyan
    new THREE.MeshStandardMaterial({ color: 0xff00ff })  // Magenta
];
const winMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff66, 
    emissive: 0x00ff66, 
    emissiveIntensity: 0.5 
});

const player = new THREE.Mesh(geometry, originalPlayerMaterials);
player.add(axesHelper); // Attach axes to player
scene.add(player);

// Target Wireframe/Glowing Box
const targetMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, 
    wireframe: true, 
    transparent: true, 
    opacity: 0.5 
});
const target = new THREE.Mesh(geometry, targetMaterial);
scene.add(target);

// --- Game State ---
let currentLevel = 1;
let levelWon = false;
let initialMatrix = new THREE.Matrix4();
let targetMatrix = new THREE.Matrix4();

let initT = { x: 0, y: 0, z: 0 };
let initR = { x: 0, y: 0, z: 0 };
let initS = { x: 1, y: 1, z: 1 };

// --- Core Math & Logic ---

// Update player position based on sliders
function updatePlayerFromSliders() {
    if (levelWon) return; // Lock controls on win

    const tx = parseFloat(sliders.t.x.value);
    const ty = parseFloat(sliders.t.y.value);
    const tz = parseFloat(sliders.t.z.value);
    
    const rx = parseFloat(sliders.r.x.value);
    const ry = parseFloat(sliders.r.y.value);
    const rz = parseFloat(sliders.r.z.value);
    
    const sx = parseFloat(sliders.s.x.value);
    const sy = parseFloat(sliders.s.y.value);
    const sz = parseFloat(sliders.s.z.value);

    // Update Player Object
    player.position.set(tx, ty, tz);
    player.rotation.set(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz)
    );
    player.scale.set(sx, sy, sz);
    
    // Update labels
    vals.t.x.textContent = tx.toFixed(1);
    vals.t.y.textContent = ty.toFixed(1);
    vals.t.z.textContent = tz.toFixed(1);
    
    vals.r.x.textContent = rx;
    vals.r.y.textContent = ry;
    vals.r.z.textContent = rz;
    
    vals.s.x.textContent = sx.toFixed(1);
    vals.s.y.textContent = sy.toFixed(1);
    vals.s.z.textContent = sz.toFixed(1);

    // Update Coordinates Overlay
    coordX.textContent = tx.toFixed(1);
    coordY.textContent = ty.toFixed(1);
    coordZ.textContent = tz.toFixed(1);

    player.updateMatrix();
    updateLiveMatricesHTML(tx, ty, tz, rx, ry, rz, sx, sy, sz);
    updateTheoryContent();
}

// Generate HTML Table from a Three.js Matrix4
function formatMatrixTable(matrixElements, highlightIndices = [], targetElements = null) {
    let html = '';
    // Three.js elements are column-major, we need row-major for HTML table
    for (let row = 0; row < 4; row++) {
        html += '<tr>';
        for (let col = 0; col < 4; col++) {
            const index = col * 4 + row;
            const val = matrixElements[index];
            const className = highlightIndices.includes(index) ? 'highlight-var' : '';
            
            let style = '';
            if (targetElements) {
                const diff = Math.abs(val - targetElements[index]);
                if (diff <= 0.05) {
                    style = 'style="color: var(--win-color);"';
                } else if (diff < 5.0) {
                    const t = Math.max(0, 1 - (diff / 5));
                    // Interpolate between Red (255, 50, 50) and Green (0, 255, 102)
                    const r = Math.floor(255 * (1 - t));
                    const g = Math.floor(255 * t);
                    const b = Math.floor(102 * t + 50 * (1 - t));
                    style = `style="color: rgb(${r}, ${g}, ${b});"`;
                } else {
                    style = 'style="color: #ff3333;"';
                }
            }

            html += `<td class="${className}" ${style}>${val.toFixed(2)}</td>`;
        }
        html += '</tr>';
    }
    return html;
}

// Update the bottom live matrix displays
function updateLiveMatricesHTML(tx, ty, tz, rx, ry, rz, sx, sy, sz) {
    // Dynamic Equations
    document.getElementById('eq-t').innerHTML = `<code>P' = P + [${tx.toFixed(1)}, ${ty.toFixed(1)}, ${tz.toFixed(1)}]</code>`;
    document.getElementById('eq-r').innerHTML = `<code>P' = Rot(${rx}&deg;, ${ry}&deg;, ${rz}&deg;) &times; P</code>`;
    document.getElementById('eq-s').innerHTML = `<code>P' = [${sx.toFixed(1)}x, ${sy.toFixed(1)}y, ${sz.toFixed(1)}z]</code>`;

    // Pure Translation
    const matT = new THREE.Matrix4().makeTranslation(tx, ty, tz);
    tables.t.innerHTML = formatMatrixTable(matT.elements, [12, 13, 14]);

    // Pure Rotation (Euler order XYZ standard in Three.js)
    const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rx), 
        THREE.MathUtils.degToRad(ry), 
        THREE.MathUtils.degToRad(rz)
    );
    const matR = new THREE.Matrix4().makeRotationFromEuler(euler);
    tables.r.innerHTML = formatMatrixTable(matR.elements, [0, 1, 2, 4, 5, 6, 8, 9, 10]);

    // Pure Scaling
    const matS = new THREE.Matrix4().makeScale(sx, sy, sz);
    tables.s.innerHTML = formatMatrixTable(matS.elements, [0, 5, 10]);

    // Composite Player Matrix (color coded against target)
    tables.composite.innerHTML = formatMatrixTable(player.matrix.elements, [], targetMatrix.elements);
}

// Generates a random discrete value within bounds
function randomVal(min, max, step) {
    const steps = Math.floor((max - min) / step);
    const randStep = Math.floor(Math.random() * (steps + 1));
    return min + randStep * step;
}

// Level Setup Logic
function loadLevel(level) {
    currentLevel = level;
    levelWon = false;
    winOverlay.classList.add('hidden');
    player.material = originalPlayerMaterials;

    // Default target state
    let targetT = { x: 0, y: 0, z: 0 };
    let targetR = { x: 0, y: 0, z: 0 };
    let targetS = { x: 1, y: 1, z: 1 };

    // Default player initial state
    initT = { x: 0, y: 0, z: 0 };
    initR = { x: 0, y: 0, z: 0 };
    initS = { x: 1, y: 1, z: 1 };

    // Enable all sliders first
    Object.values(sliders).forEach(group => {
        Object.values(group).forEach(slider => slider.disabled = false);
    });

    if (level == 1) {
        // Translation Only
        targetT = { x: randomVal(-4, 4, 1), y: randomVal(-4, 4, 1), z: randomVal(-4, 4, 1) };
        disableSliders(sliders.r);
        disableSliders(sliders.s);
    } 
    else if (level == 2) {
        // Translation & Scaling
        targetT = { x: randomVal(-4, 4, 1), y: randomVal(-4, 4, 1), z: randomVal(-4, 4, 1) };
        targetS = { x: randomVal(0.5, 2.5, 0.5), y: randomVal(0.5, 2.5, 0.5), z: randomVal(0.5, 2.5, 0.5) };
        disableSliders(sliders.r);
    } 
    else if (level == 3) {
        // Rotation Only
        targetR = { x: randomVal(0, 315, 45), y: randomVal(0, 315, 45), z: randomVal(0, 315, 45) };
        disableSliders(sliders.t);
        disableSliders(sliders.s);
    } 
    else if (level == 4) {
        // Full Composite
        targetT = { x: randomVal(-3, 3, 1), y: randomVal(-3, 3, 1), z: randomVal(-3, 3, 1) };
        targetR = { x: randomVal(0, 315, 45), y: randomVal(0, 315, 45), z: randomVal(0, 315, 45) };
        targetS = { x: randomVal(0.5, 2, 0.5), y: randomVal(0.5, 2, 0.5), z: randomVal(0.5, 2, 0.5) };
        
        // Randomize initial state
        initT = { x: randomVal(-3, 3, 1), y: randomVal(-3, 3, 1), z: randomVal(-3, 3, 1) };
        initR = { x: randomVal(0, 315, 45), y: randomVal(0, 315, 45), z: randomVal(0, 315, 45) };
        initS = { x: randomVal(0.5, 2, 0.5), y: randomVal(0.5, 2, 0.5), z: randomVal(0.5, 2, 0.5) };
    }

    // Prevent target from being exactly equal to initial
    if (JSON.stringify(targetT) === JSON.stringify(initT) && 
        JSON.stringify(targetR) === JSON.stringify(initR) && 
        JSON.stringify(targetS) === JSON.stringify(initS)) {
        targetT.x += 1; // Simple hack to ensure they aren't the exact same state
    }

    // Apply Target state to Target Object
    target.position.set(targetT.x, targetT.y, targetT.z);
    target.rotation.set(
        THREE.MathUtils.degToRad(targetR.x),
        THREE.MathUtils.degToRad(targetR.y),
        THREE.MathUtils.degToRad(targetR.z)
    );
    target.scale.set(targetS.x, targetS.y, targetS.z);
    target.updateMatrix();

    // Store Target Matrix HTML
    targetMatrix.copy(target.matrix);
    tables.target.innerHTML = formatMatrixTable(targetMatrix.elements);

    // Set Initial Sliders
    sliders.t.x.value = initT.x; sliders.t.y.value = initT.y; sliders.t.z.value = initT.z;
    sliders.r.x.value = initR.x; sliders.r.y.value = initR.y; sliders.r.z.value = initR.z;
    sliders.s.x.value = initS.x; sliders.s.y.value = initS.y; sliders.s.z.value = initS.z;

    updatePlayerFromSliders();

    // Store Initial Matrix HTML
    initialMatrix.copy(player.matrix);
    tables.initial.innerHTML = formatMatrixTable(initialMatrix.elements);
}

function disableSliders(sliderGroup) {
    Object.values(sliderGroup).forEach(slider => slider.disabled = true);
}

// Win Condition Checking
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
        
        // Snap perfectly
        player.position.copy(target.position);
        player.rotation.copy(target.rotation);
        player.scale.copy(target.scale);
        player.updateMatrix();
        
        // Final UI Updates
        updatePlayerFromSliders();
        player.material = winMaterial;
        winOverlay.classList.remove('hidden');

        // Auto-advance level after 3 seconds
        setTimeout(() => {
            let nextLevel = currentLevel < 4 ? currentLevel + 1 : 1;
            levelSelect.value = nextLevel.toString();
            loadLevel(nextLevel);
        }, 3000);
    }
}

// --- Theory Interactions ---
let currentTheory = null;

function getTheoryData(tx, ty, tz, rx, ry, rz, sx, sy, sz) {
    return {
        translation: `
            <h3>Translation</h3>
            <p>Translation moves an object in 3D space along the X, Y, or Z axes without altering its rotation or size.</p>
            <p><strong>Equation:</strong> <code>P' = P + T</code></p>
            <p><strong>Matrix Representation:</strong></p>
            <pre>
[ 1.00  0.00  0.00  ${tx.toFixed(2)} ]
[ 0.00  1.00  0.00  ${ty.toFixed(2)} ]
[ 0.00  0.00  1.00  ${tz.toFixed(2)} ]
[ 0.00  0.00  0.00   1.00 ]
            </pre>
        `,
        rotation: `
            <h3>Rotation</h3>
            <p>Rotation pivots an object around a specific axis (X, Y, or Z) by a given angle (Theta).</p>
            <p><strong>Equation (Z-Axis):</strong><br><code>x' = x*cos(&theta;) - y*sin(&theta;)<br>y' = x*sin(&theta;) + y*cos(&theta;)</code></p>
            <p><strong>Current Matrix Representation (Composite XYZ):</strong></p>
            <p>Check the bottom R Matrix for live values based on <br>RX=${rx}&deg;, RY=${ry}&deg;, RZ=${rz}&deg;</p>
        `,
        scaling: `
            <h3>Scaling</h3>
            <p>Scaling resizes an object along the X, Y, or Z axes. A scale factor greater than 1 enlarges it, while less than 1 shrinks it.</p>
            <p><strong>Equation:</strong> <code>P' = P * S</code></p>
            <p><strong>Matrix Representation:</strong></p>
            <pre>
[ ${sx.toFixed(2)}  0.00  0.00  0.00 ]
[ 0.00  ${sy.toFixed(2)}  0.00  0.00 ]
[ 0.00  0.00  ${sz.toFixed(2)}  0.00 ]
[ 0.00  0.00  0.00  1.00 ]
            </pre>
        `
    };
}

function updateTheoryContent() {
    if (!currentTheory) return;
    
    const tx = parseFloat(sliders.t.x.value);
    const ty = parseFloat(sliders.t.y.value);
    const tz = parseFloat(sliders.t.z.value);
    
    const rx = parseFloat(sliders.r.x.value);
    const ry = parseFloat(sliders.r.y.value);
    const rz = parseFloat(sliders.r.z.value);
    
    const sx = parseFloat(sliders.s.x.value);
    const sy = parseFloat(sliders.s.y.value);
    const sz = parseFloat(sliders.s.z.value);

    const data = getTheoryData(tx, ty, tz, rx, ry, rz, sx, sy, sz);
    theoryContent.innerHTML = data[currentTheory];
}

btnTranslation.addEventListener('click', () => {
    currentTheory = 'translation';
    theoryContent.style.opacity = 0;
    setTimeout(() => {
        updateTheoryContent();
        theoryContent.style.opacity = 1;
    }, 200);
});

btnRotation.addEventListener('click', () => {
    currentTheory = 'rotation';
    theoryContent.style.opacity = 0;
    setTimeout(() => {
        updateTheoryContent();
        theoryContent.style.opacity = 1;
    }, 200);
});

btnScaling.addEventListener('click', () => {
    currentTheory = 'scaling';
    theoryContent.style.opacity = 0;
    setTimeout(() => {
        updateTheoryContent();
        theoryContent.style.opacity = 1;
    }, 200);
});


// --- Event Listeners ---

// Add listener to all sliders
Object.values(sliders).forEach(group => {
    Object.values(group).forEach(slider => {
        slider.addEventListener('input', updatePlayerFromSliders);
    });
});

// Level Selection
levelSelect.addEventListener('change', (e) => {
    loadLevel(parseInt(e.target.value));
});

// Reset Button
btnReset.addEventListener('click', () => {
    if (levelWon) return; // don't reset if won
    sliders.t.x.value = initT.x; sliders.t.y.value = initT.y; sliders.t.z.value = initT.z;
    sliders.r.x.value = initR.x; sliders.r.y.value = initR.y; sliders.r.z.value = initR.z;
    sliders.s.x.value = initS.x; sliders.s.y.value = initS.y; sliders.s.z.value = initS.z;
    updatePlayerFromSliders();
    
    // Reset camera and controls
    controls.reset();
    camera.position.set(5, 5, 10);
    controls.target.set(0, 0, 0);
    controls.update();
});

// Axes Toggle
btnToggleAxes.addEventListener('click', () => {
    axesHelper.visible = !axesHelper.visible;
    btnToggleAxes.textContent = axesHelper.visible ? "Hide Local Axes" : "Show Local Axes";
});

// Window Resize
window.addEventListener('resize', () => {
    camera.aspect = viewportContainer.clientWidth / viewportContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewportContainer.clientWidth, viewportContainer.clientHeight);
});


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    checkWinCondition();
    
    renderer.render(scene, camera);
}

// Init
loadLevel(1);
animate();
