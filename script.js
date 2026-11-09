/* =========================================================
   Parque Científico Interactivo - Lógica y Controles
   ========================================================= */

/* ---------- Estado del teclado ---------- */
const keys = Object.create(null);
const BLOCKED = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    keys[e.key]  = true;
    if (BLOCKED.includes(e.code) || BLOCKED.includes(e.key)) e.preventDefault();
}, { passive: false });

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    keys[e.key]  = false;
});

window.addEventListener('blur', () => { 
    for (const k in keys) keys[k] = false; 
});

/* ---------- Ajustes de movimiento ---------- */
const CAR_SPEED     = 4.04;  
const CAMERA_SPEED  = 3.535; 
const CAMERA_HEIGHT = 1.8;
const LIMIT         = 28;    
const TURN_SPEED    = 5;     

/* ---------- Utilidades ---------- */
const clock = new THREE.Clock();
let carEl = null, camEl = null;
const getCar = () => carEl || (carEl = document.querySelector('#car'));
const getCam = () => camEl || (camEl = document.querySelector('#camera'));
const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

function shortestAngle(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d >  Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}

/* ---------- Lógica del Auto ---------- */
function updateCar(dt) {
    const car = getCar(); if (!car) return;
    const obj = car.object3D, pos = obj.position;

    let dx = 0, dz = 0;
    if (keys['ArrowUp'])    dz += 1;
    if (keys['ArrowDown'])  dz -= 1;
    if (keys['ArrowLeft'])  dx -= 1; 
    if (keys['ArrowRight']) dx += 1;

    if (!dx && !dz) return;

    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;

    pos.x = clamp(pos.x + dx * CAR_SPEED * dt, -LIMIT, LIMIT);
    pos.z = clamp(pos.z + dz * CAR_SPEED * dt, -LIMIT, LIMIT);

    const targetYaw = Math.atan2(dx, dz);
    const t = Math.min(1, dt * TURN_SPEED);
    obj.rotation.y += shortestAngle(obj.rotation.y, targetYaw) * t;
}

/* ---------- Lógica de la Cámara ---------- */
function updateCamera(dt) {
    const cam = getCam(); if (!cam) return;
    const obj = cam.object3D;

    obj.updateWorldMatrix(true, false);
    const e = obj.matrixWorld.elements;

    let rx =  e[0], rz =  e[2];        
    let fx = -e[8], fz = -e[10];       

    const rlen = Math.hypot(rx, rz);
    const flen = Math.hypot(fx, fz);
    if (rlen < 1e-6 || flen < 1e-6) {
        obj.position.y = CAMERA_HEIGHT;
        return;
    }
    rx /= rlen; rz /= rlen;
    fx /= flen; fz /= flen;

    let vx = 0, vz = 0;
    if (keys['KeyW']) { vx += fx; vz += fz; }
    if (keys['KeyS']) { vx -= fx; vz -= fz; }
    if (keys['KeyD']) { vx += rx; vz += rz; }
    if (keys['KeyA']) { vx -= rx; vz -= rz; }

    const len = Math.hypot(vx, vz);
    if (len > 0) {
        vx /= len; vz /= len;
        obj.position.x = clamp(obj.position.x + vx * CAMERA_SPEED * dt, -LIMIT, LIMIT);
        obj.position.z = clamp(obj.position.z + vz * CAMERA_SPEED * dt, -LIMIT, LIMIT);
    }
    obj.position.y = CAMERA_HEIGHT;
}

/* ---------- Componente: Brisa para los árboles ---------- */
AFRAME.registerComponent('wind-sway', {
    schema: {
        speed: { type: 'number', default: 1.5 },
        intensity: { type: 'number', default: 1.5 }
    },
    init: function () {
        this.baseRotationX = this.el.object3D.rotation.x;
        this.baseRotationZ = this.el.object3D.rotation.z;
        this.offset = Math.random() * Math.PI * 2; 
    },
    tick: function (time) {
        const t = time / 1000; 
        const swayX = Math.sin(t * this.data.speed + this.offset) * (this.data.intensity * Math.PI / 180);
        const swayZ = Math.cos(t * this.data.speed * 0.8 + this.offset) * (this.data.intensity * Math.PI / 180);

        this.el.object3D.rotation.x = this.baseRotationX + swayX;
        this.el.object3D.rotation.z = this.baseRotationZ + swayZ;
    }
});

/* ---------- Componente: Persona Caminando (Con límites) ---------- */
AFRAME.registerComponent('walk-path', {
    schema: {
        speed: { type: 'number', default: 1 }, 
        limit: { type: 'number', default: 14 },
        bobHeight: { type: 'number', default: 0.08 },
        swayAngle: { type: 'number', default: 6 } 
    },
    init: function() {
        this.baseY = this.el.object3D.position.y;         
        this.baseRotationY = this.el.object3D.rotation.y;
    },
    tick: function (time, timeDelta) {
        if (!this.el.getObject3D('mesh') && this.el.children.length === 0) return; 

        const obj = this.el.object3D;
        const dt = timeDelta / 1000;

        const moveAmount = this.data.speed * dt;
        const forward = new THREE.Vector3(0, 0, moveAmount);
        forward.applyQuaternion(obj.quaternion);
        const nextPos = obj.position.clone().add(forward);

        if (nextPos.x > this.data.limit || nextPos.x < -this.data.limit ||
            nextPos.z > this.data.limit || nextPos.z < -this.data.limit) {
            this.baseRotationY += Math.PI;
            obj.rotation.y = this.baseRotationY;
        } else {
            obj.position.copy(nextPos);
        }

        const walkCycle = time / 150; 
        obj.position.y = this.baseY + Math.abs(Math.sin(walkCycle)) * this.data.bobHeight;
        obj.rotation.z = Math.sin(walkCycle) * (this.data.swayAngle * Math.PI / 180);
    }
});

/* ---------- Componente: Zorro Caminando (Con límites) ---------- */
AFRAME.registerComponent('fox-walk', {
    schema: {
        speed: { type: 'number', default: 1 },
        limit: { type: 'number', default: 14 } 
    },
    init: function() {
        this.baseRotationY = this.el.object3D.rotation.y;
    },
    tick: function (time, timeDelta) {
        if (!this.el.getObject3D('mesh') && this.el.children.length === 0) return;

        const obj = this.el.object3D;
        const dt = timeDelta / 1000;

        const moveAmount = this.data.speed * dt;
        const forward = new THREE.Vector3(0, 0, moveAmount);
        forward.applyQuaternion(obj.quaternion);
        const nextPos = obj.position.clone().add(forward);

        if (nextPos.x > this.data.limit || nextPos.x < -this.data.limit ||
            nextPos.z > this.data.limit || nextPos.z < -this.data.limit) {
            this.baseRotationY += Math.PI;
            obj.rotation.y = this.baseRotationY;
        } else {
            obj.position.copy(nextPos);
        }
    }
});

/* ---------- Bucle Principal ---------- */
function tick() {
    const dt = Math.min(clock.getDelta(), 0.1);
    updateCar(dt);
    updateCamera(dt);
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* =========================================================
   INTERACTIVIDAD, SONIDOS, EDUCACIÓN Y REINICIO
   ========================================================= */

function hablarTexto(texto) {
    window.speechSynthesis.cancel(); 
    const mensaje = new SpeechSynthesisUtterance(texto);
    mensaje.lang = 'es-ES'; 
    mensaje.pitch = 1.1; 
    mensaje.rate = 1; 
    mensaje.volume = 0.8; 
    window.speechSynthesis.speak(mensaje);
}

function mostrarPanel(titulo, texto) {
    const panel = document.querySelector('#panel-educativo');
    const panelTitulo = document.querySelector('#panel-titulo');
    const panelTexto = document.querySelector('#panel-texto');
    if (!panel) return;
    panelTitulo.textContent = titulo;
    panelTexto.textContent = texto;
    panel.classList.add('visible');
    clearTimeout(window.panelTimeout); 
    window.panelTimeout = setTimeout(() => {
        panel.classList.remove('visible');
    }, 8000);
}

window.addEventListener('load', () => {
    
    // --- SONIDO DE FONDO (Pasos) ---
    const bgAudio = document.querySelector('#bg-audio');
    let audioStarted = false;

    if (bgAudio) {
        bgAudio.volume = 0.9; 
        const iniciarAudio = () => {
            if (!audioStarted) {
                bgAudio.play().catch(e => console.log("El navegador bloqueó el audio:", e));
                audioStarted = true;
            }
        };
        document.body.addEventListener('click', iniciarAudio, { once: true });
        document.body.addEventListener('touchstart', iniciarAudio, { once: true });
    }

    // --- ANIMALES Y VEHÍCULOS ---
    
    // Gato
    const cat = document.querySelector('#cat');
    const meowAudio = document.querySelector('#meow-audio');
    if (meowAudio) meowAudio.volume = 0.5; 

    if (cat) {
        cat.addEventListener('click', () => {
            if (meowAudio) { meowAudio.currentTime = 0; meowAudio.play().catch(e => console.log(e)); }
            
            // Animación usando la propiedad 'position' correcta
            cat.removeAttribute('animation__up');
            cat.removeAttribute('animation__down');
            cat.setAttribute('animation__up', { property: 'position', to: '-7 1.2 10', dur: 200, easing: 'easeOutQuad' });
            setTimeout(() => {
                cat.setAttribute('animation__down', { property: 'position', to: '-7 0.1 10', dur: 250, easing: 'easeInQuad' });
            }, 200);
            
            mostrarPanel("🐈 El Gato", "Los gatos tienen 32 músculos en cada oreja y pueden girarlas 180 grados independientemente para localizar sonidos.");
            hablarTexto("Dato curioso: Los gatos tienen 32 músculos en cada oreja y pueden girarlas 180 grados.");
        });
    }

    // Auto
    const car = document.querySelector('#car');
    const carSound = new Audio('./models/car_sound.mp3'); 
    carSound.volume = 0.4; 
    if (car) {
        car.addEventListener('click', () => {
            carSound.currentTime = 0; carSound.play().catch(error => console.error(error));
            mostrarPanel("🚗 El Automóvil", "El primer automóvil a gasolina funcional fue creado por Karl Benz en el año 1886, cambiando la historia del transporte.");
            hablarTexto("Dato histórico: El primer automóvil a gasolina funcional fue creado por Karl Benz en el año 1886.");
        });
    }

    // Zorro
    const foxEdu = document.querySelector('#fox-edu');
    if (foxEdu) {
        foxEdu.addEventListener('click', () => {
            mostrarPanel("🦊 El Zorro", "Los zorros tienen un oído tan agudo que pueden escuchar a pequeños roedores moviéndose bajo la nieve o la tierra, e incluso pueden usar el campo magnético de la Tierra para cazar.");
            hablarTexto("Dato biológico: Los zorros tienen un oído tan agudo que pueden escuchar pequeños animales moviéndose bajo la tierra.");
        });
    }

    // Casa
    const casaEdu = document.querySelector('#casa-edu');
    if (casaEdu) {
        casaEdu.addEventListener('click', () => {
            mostrarPanel("🏠 La Casa", "Las casas ecológicas utilizan paneles solares en sus techos para captar la energía del sol y transformarla en electricidad para el hogar.");
            hablarTexto("Dato ecológico: Las casas modernas utilizan paneles solares para captar la energía del sol y generar electricidad limpia.");
        });
    }

    // --- ÁRBOLES EDUCATIVOS (8 DATOS) ---

    const arbolEdu = document.querySelector('#arbol-edu');
    if (arbolEdu) {
        arbolEdu.addEventListener('click', () => {
            mostrarPanel("🌳 El Árbol", "Un árbol maduro puede absorber hasta 22 kg de CO2 al año, produciendo oxígeno y ayudando a limpiar el aire que respiramos.");
            hablarTexto("Dato científico: Un árbol maduro puede absorber hasta 22 kilogramos de dióxido de carbono al año.");
        });
    }

    const arbolAmarilloEdu = document.querySelector('#arbol-amarillo-edu');
    if (arbolAmarilloEdu) {
        arbolAmarilloEdu.addEventListener('click', () => {
            mostrarPanel("🍂 El Árbol de Otoño", "Las hojas cambian de color en otoño porque los días se acortan y el árbol deja de producir clorofila, revelando los colores amarillos.");
            hablarTexto("Dato biológico: Las hojas cambian de color en otoño porque los árboles dejan de producir clorofila, el pigmento verde.");
        });
    }

    const arbolAgua = document.querySelector('#arbol-agua-edu');
    if (arbolAgua) {
        arbolAgua.addEventListener('click', () => {
            mostrarPanel("💧 El Agua", "Los árboles necesitan alrededor de 2.000 litros de agua cada año para poder crecer y mantenerse sanos.");
            hablarTexto("Dato curioso: Los árboles necesitan alrededor de 2.000 litros de agua cada año.");
        });
    }

    const arbolHistoria = document.querySelector('#arbol-historia-edu');
    if (arbolHistoria) {
        arbolHistoria.addEventListener('click', () => {
            mostrarPanel("🌍 Historia de los Árboles", "La Tierra cuenta con un 46% menos de árboles que hace 12.000 años atrás.");
            hablarTexto("Dato histórico: La Tierra cuenta con un 46 por ciento menos de árboles que hace 12.000 años.");
        });
    }

    const arbolAire = document.querySelector('#arbol-aire-edu');
    if (arbolAire) {
        arbolAire.addEventListener('click', () => {
            mostrarPanel("💨 Viven del Aire", "Los árboles absorben el 90% de lo que necesitan para su nutrición de la atmósfera y solo el 10% del suelo.");
            hablarTexto("Dato científico: Los árboles viven del aire. Absorben el 90 por ciento de lo que necesitan de la atmósfera y el 10 por ciento del suelo.");
        });
    }

    const arbolRed = document.querySelector('#arbol-red-edu');
    if (arbolRed) {
        arbolRed.addEventListener('click', () => {
            mostrarPanel("🕸️ Red Subterránea", "Los árboles se comunican por debajo de la tierra. Crean conexiones a través de sus raíces y hongos para transmitir nutrientes.");
            hablarTexto("Dato sorprendente: Los árboles se comunican por debajo de la tierra a través de sus raíces y hongos para transmitir nutrientes.");
        });
    }

    const arbolOxigeno = document.querySelector('#arbol-oxigeno-edu');
    if (arbolOxigeno) {
        arbolOxigeno.addEventListener('click', () => {
            mostrarPanel("🌿 Oxígeno Puro", "Un solo árbol puede generar el oxígeno que necesitan hasta 4 personas para respirar durante todo un día.");
            hablarTexto("Dato ecológico: Un solo árbol puede generar el oxígeno que necesitan hasta 4 personas al día.");
        });
    }

    const arbolErosion = document.querySelector('#arbol-erosion-edu');
    if (arbolErosion) {
        arbolErosion.addEventListener('click', () => {
            mostrarPanel("⛰️ Protector del Suelo", "Las raíces de los árboles sostienen la tierra y evitan que el agua de la lluvia se lleve los nutrientes del suelo, previniendo la erosión.");
            hablarTexto("Dato ambiental: Las raíces de los árboles sostienen la tierra y previenen la erosión del suelo.");
        });
    }
});

// --- Botón de Reinicio ---
window.resetGame = function() {
    const car = document.querySelector('#car');
    const camera = document.querySelector('#camera');
    const panel = document.querySelector('#panel-educativo');

    for (const k in keys) keys[k] = false;

    if (car) {
        car.setAttribute('position', '0 0 2');
        car.setAttribute('rotation', '0 0 0');
    }
    
    if (camera) {
        camera.setAttribute('look-controls', 'enabled', false);
        camera.setAttribute('position', '0 0.1 17');
        const lookControls = camera.components['look-controls'];
        if (lookControls) {
            if (lookControls.pitchObject) lookControls.pitchObject.rotation.x = 0;
            if (lookControls.yawObject) lookControls.yawObject.rotation.y = 0;
        }
        camera.setAttribute('rotation', '0 0 0');
        camera.setAttribute('look-controls', 'enabled', true);
    }

    if (panel) panel.classList.remove('visible');
    clearTimeout(window.panelTimeout);
    window.speechSynthesis.cancel();
};