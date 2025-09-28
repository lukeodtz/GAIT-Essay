// ======= SETTINGS (live tunable) =======
const SETTINGS = {
  mouseSensitivity: 0.0012,
  keyRotSpeed: 0.08,     // rad/s (fine default)
  thrust: 18,            // units/s^2
  linearDamping: 0.6,    // per second
  angularDamping: 3.0,   // per second
  maxSpeed: 120,         // units/s
  strafeSpeed: 12,       // units/s
  starSizeNear: 1.8,
  starSizeFar: 2.6
};

// ======= THREE BASICS =======
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.2, 5000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("bg"), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.PointLight(0xffffff, 1.2, 0, 2);
keyLight.position.set(40, 50, 60);
scene.add(keyLight);

// ======= STARFIELD (two layers, brighter) =======
let star1Mat, star2Mat;
(function addStarfield() {
  function makeLayer(count, radius, size, color) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size, sizeAttenuation: true });
    const pts = new THREE.Points(geom, mat);
    scene.add(pts);
    return mat;
  }
  star1Mat = makeLayer(1400, 950, SETTINGS.starSizeNear, 0xffffff);
  star2Mat = makeLayer(900, 1400, SETTINGS.starSizeFar, 0xddddff);
})();

// ======= SHIP (visible model) =======
const shipGroup = new THREE.Group();
scene.add(shipGroup);

// Body
const bodyGeo = new THREE.ConeGeometry(0.6, 2.2, 20);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, metalness: 0.2, roughness: 0.5 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.rotation.x = Math.PI / 2; // nose forward (-Z)
shipGroup.add(body);

// Wings
const wingGeo = new THREE.BoxGeometry(2.0, 0.1, 0.35);
const wingMat = new THREE.MeshStandardMaterial({ color: 0x0077ff, metalness: 0.1, roughness: 0.6 });
const wing = new THREE.Mesh(wingGeo, wingMat);
wing.position.set(0, -0.25, -0.5);
shipGroup.add(wing);

// Tail fin
const tailGeo = new THREE.BoxGeometry(0.1, 0.8, 0.4);
const tail = new THREE.Mesh(tailGeo, wingMat);
tail.position.set(0, 0.35, -0.9);
shipGroup.add(tail);

// Thruster glow
const thrusterGeo = new THREE.ConeGeometry(0.35, 0.9, 16);
const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
thruster.position.set(0, 0, 1.2);
thruster.rotation.x = -Math.PI / 2;
thruster.scale.set(0.6, 0.6, 0.6);
shipGroup.add(thruster);

// Ship state
shipGroup.position.set(0, 0, 50);
let velocity = new THREE.Vector3(0, 0, 0);
const angularVel = { pitch: 0, yaw: 0, roll: 0 };

// ======= ASTEROIDS WITH OPINIONS (drifting) =======
const opinions = [
  "AI is a tool, not a replacement.",
  "Over-reliance could make us lose critical skills.",
  "AI may widen the gap between those who know how to use it and those who don’t.",
  "Excited for AI in research – solving problems faster.",
  "Worried about privacy, surveillance, and digital security.",
  "AI should never govern without humans – accountability matters.",
  "Humans must value creativity in the arts over machine efficiency."
];

const asteroids = [];
const ASTEROID_RADIUS = 12.0;   // bigger asteroids
const FIELD_RANGE = 260;        // spawn range
const WRAP_RANGE = 420;         // wrap limits
(function spawnAsteroids() {
  for (let i = 0; i < opinions.length; i++) {
    const geo = new THREE.DodecahedronGeometry(ASTEROID_RADIUS, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8c7c7c,       // requested color
      flatShading: true,
      metalness: 0.15,
      roughness: 0.9,
      emissive: 0x222222,
      emissiveIntensity: 0.25
    });
    const a = new THREE.Mesh(geo, mat);

    // Position away from start
    let pos;
    do {
      pos = new THREE.Vector3(
        (Math.random() - 0.5) * FIELD_RANGE * 2,
        (Math.random() - 0.5) * FIELD_RANGE * 2,
        (Math.random() - 0.5) * FIELD_RANGE * 2
      );
    } while (pos.length() < 40);

    a.position.copy(pos);

    // Spin + drift velocity
    a.userData.spin = new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6
    ).multiplyScalar(0.25);

    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const speed = 6 + Math.random() * 10; // units/s
    a.userData.vel = dir.multiplyScalar(speed);

    a.userData.text = opinions[i];
    a.userData.collected = false;

    scene.add(a);
    asteroids.push(a);
  }
})();

function wrapAsteroid(a) {
  if (a.position.x > WRAP_RANGE) a.position.x = -WRAP_RANGE;
  if (a.position.x < -WRAP_RANGE) a.position.x = WRAP_RANGE;
  if (a.position.y > WRAP_RANGE) a.position.y = -WRAP_RANGE;
  if (a.position.y < -WRAP_RANGE) a.position.y = WRAP_RANGE;
  if (a.position.z > WRAP_RANGE) a.position.z = -WRAP_RANGE;
  if (a.position.z < -WRAP_RANGE) a.position.z = WRAP_RANGE;
}

// ======= BULLETS (declared ONCE) =======
const BULLET_SPEED = 60;        // units/s
const BULLET_RADIUS = 0.2;
const BULLET_LIFETIME = 4.0;    // seconds (was 3.0) -> goes a bit farther
const bullets = [];

// ======= UI =======
const messageBox = document.getElementById("messageBox");
const messageText = document.getElementById("messageText");
const scoreDisplay = document.getElementById("score");
const lockHint = document.getElementById("lockHint");
const winOverlay = document.getElementById("win");
const opinionListEl = document.getElementById("opinionList");
const restartBtn = document.getElementById("restartBtn");
const viewPaperBtn = document.getElementById("viewPaperBtn");
const paperView = document.getElementById("paperView");
const backToGameBtn = document.getElementById("backToGame");

restartBtn.addEventListener("click", () => location.reload());
viewPaperBtn.addEventListener("click", () => {
  // Ensure mouse is free and show paper
  document.exitPointerLock();
  winOverlay.classList.add("hidden");
  paperView.classList.remove("hidden");
});
backToGameBtn.addEventListener("click", () => {
  paperView.classList.add("hidden");
  winOverlay.classList.remove("hidden");
  // mouse stays free until user clicks canvas again
});

const collected = new Set();
function showMessage(text) {
  messageText.textContent = text;
  messageBox.style.display = "block";
  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => { messageBox.style.display = "none"; }, 4500);
}
function populateEndList() {
  opinionListEl.innerHTML = "";
  opinions.forEach(op => {
    const li = document.createElement("li");
    li.textContent = op;
    opinionListEl.appendChild(li);
  });
}
function updateScore() {
  scoreDisplay.textContent = `Collected: ${collected.size} / ${opinions.length}`;
  if (collected.size === opinions.length) {
    populateEndList();
    winOverlay.classList.remove("hidden");
    document.exitPointerLock();   // release mouse so buttons are clickable
  }
}
updateScore();

// ======= SETTINGS UI =======
const settingsEl = document.getElementById("settings");
document.getElementById("closeSettings").addEventListener("click", () => {
  settingsEl.classList.add("hidden");
  document.body.requestPointerLock();
});
const ranges = {
  mouseSens:  document.getElementById("mouseSens"),
  keyRot:     document.getElementById("keyRot"),
  thrust:     document.getElementById("thrust"),
  linDamp:    document.getElementById("linDamp"),
  angDamp:    document.getElementById("angDamp"),
  maxSpeed:   document.getElementById("maxSpeed"),
  strafe:     document.getElementById("strafe"),
  star1:      document.getElementById("star1"),
  star2:      document.getElementById("star2"),
};
const labels = {
  mouseSensVal: document.getElementById("mouseSensVal"),
  keyRotVal:    document.getElementById("keyRotVal"),
  thrustVal:    document.getElementById("thrustVal"),
  linDampVal:   document.getElementById("linDampVal"),
  angDampVal:   document.getElementById("angDampVal"),
  maxSpeedVal:  document.getElementById("maxSpeedVal"),
  strafeVal:    document.getElementById("strafeVal"),
  star1Val:     document.getElementById("star1Val"),
  star2Val:     document.getElementById("star2Val"),
};

function syncUI() {
  ranges.mouseSens.value = SETTINGS.mouseSensitivity;
  ranges.keyRot.value    = SETTINGS.keyRotSpeed;
  ranges.thrust.value    = SETTINGS.thrust;
  ranges.linDamp.value   = SETTINGS.linearDamping;
  ranges.angDamp.value   = SETTINGS.angularDamping;
  ranges.maxSpeed.value  = SETTINGS.maxSpeed;
  ranges.strafe.value    = SETTINGS.strafeSpeed;
  ranges.star1.value     = SETTINGS.starSizeNear;
  ranges.star2.value     = SETTINGS.starSizeFar;

  labels.mouseSensVal.textContent = SETTINGS.mouseSensitivity.toFixed(4);
  labels.keyRotVal.textContent    = SETTINGS.keyRotSpeed.toFixed(2);
  labels.thrustVal.textContent    = SETTINGS.thrust.toFixed(0);
  labels.linDampVal.textContent   = SETTINGS.linearDamping.toFixed(2);
  labels.angDampVal.textContent   = SETTINGS.angularDamping.toFixed(1);
  labels.maxSpeedVal.textContent  = SETTINGS.maxSpeed.toFixed(0);
  labels.strafeVal.textContent    = SETTINGS.strafeSpeed.toFixed(0);
  labels.star1Val.textContent     = SETTINGS.starSizeNear.toFixed(1);
  labels.star2Val.textContent     = SETTINGS.starSizeFar.toFixed(1);
}
syncUI();

function attachRange(id, setter) {
  const r = ranges[id];
  const l = labels[id + "Val"];
  r.addEventListener("input", () => {
    const v = parseFloat(r.value);
    setter(v);
    if (id === "mouseSens") l.textContent = v.toFixed(4);
    else if (id === "keyRot") l.textContent = v.toFixed(2);
    else if (id === "linDamp") l.textContent = v.toFixed(2);
    else if (id.startsWith("star")) l.textContent = v.toFixed(1);
    else l.textContent = v.toFixed(0);
    if (id === "star1" && star1Mat) star1Mat.size = SETTINGS.starSizeNear;
    if (id === "star2" && star2Mat) star2Mat.size = SETTINGS.starSizeFar;
  });
}
attachRange("mouseSens", v => SETTINGS.mouseSensitivity = v);
attachRange("keyRot",    v => SETTINGS.keyRotSpeed = v);
attachRange("thrust",    v => SETTINGS.thrust = v);
attachRange("linDamp",   v => SETTINGS.linearDamping = v);
attachRange("angDamp",   v => SETTINGS.angularDamping = v);
attachRange("maxSpeed",  v => SETTINGS.maxSpeed = v);
attachRange("strafe",    v => SETTINGS.strafeSpeed = v);
attachRange("star1",     v => SETTINGS.starSizeNear = v);
attachRange("star2",     v => SETTINGS.starSizeFar = v);

// Toggle settings with Esc
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
      settingsEl.classList.remove("hidden");
    } else {
      settingsEl.classList.add("hidden");
      document.body.requestPointerLock();
    }
  }
});

// ======= INPUT =======
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// Pointer lock
document.body.addEventListener("click", () => {
  if (document.pointerLockElement !== document.body &&
      settingsEl.classList.contains("hidden") &&
      paperView.classList.contains("hidden")) {
    document.body.requestPointerLock();
  }
});
document.addEventListener("pointerlockchange", () => {
  lockHint.style.display = (document.pointerLockElement === document.body) ? "none" : "inline-block";
});

// Mouse fine adjustments (NO ROLL)
// Yaw was inverted before — fixed here by flipping the sign.
let mouseDelta = { pitch: 0, yaw: 0 };
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === document.body) {
    mouseDelta.yaw   -= e.movementX * SETTINGS.mouseSensitivity;  // flip sign to fix inversion
    mouseDelta.pitch += -e.movementY * SETTINGS.mouseSensitivity;
  }
});

// Shooting
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    const geo = new THREE.SphereGeometry(BULLET_RADIUS, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(geo, mat);

    // Spawn from nose (ship-local forward)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipGroup.quaternion);
    bullet.position.copy(shipGroup.position).add(forward.clone().multiplyScalar(1.6));
    bullet.userData.velocity = forward.clone().multiplyScalar(BULLET_SPEED);
    bullet.userData.born = performance.now() / 1000;

    scene.add(bullet);
    bullets.push(bullet);

    // Thruster flash
    thruster.scale.setScalar(0.9 + Math.random() * 0.4);
  }
});

// ======= CAMERA FOLLOW (locked to ship roll) =======
function updateCamera() {
  const camOffset = new THREE.Vector3(0, 2.2, 7).applyQuaternion(shipGroup.quaternion);
  camera.position.copy(shipGroup.position).add(camOffset);
  camera.quaternion.copy(shipGroup.quaternion);
}

// ======= HELPERS =======
function clampSpeed(vec, maxLen) {
  if (vec.length() > maxLen) vec.setLength(maxLen);
}

// ======= MAIN LOOP =======
let lastTime = performance.now() / 1000;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() / 1000;
  const dt = Math.min(0.033, Math.max(0.001, now - lastTime)); // clamp dt
  lastTime = now;

  // ---- ANGULAR INPUT (local axes via quaternions) ----
  if (keys["w"]) angularVel.pitch += SETTINGS.keyRotSpeed * dt;   // pitch up (relative to wings)
  if (keys["s"]) angularVel.pitch -= SETTINGS.keyRotSpeed * dt;   // pitch down
  if (keys["a"]) angularVel.yaw   += SETTINGS.keyRotSpeed * dt;   // yaw left
  if (keys["d"]) angularVel.yaw   -= SETTINGS.keyRotSpeed * dt;   // yaw right
  if (keys["q"]) angularVel.roll  += SETTINGS.keyRotSpeed * dt;   // roll left
  if (keys["e"]) angularVel.roll  -= SETTINGS.keyRotSpeed * dt;   // roll right

  // Mouse fine adjustment (no roll)
  angularVel.pitch += mouseDelta.pitch;
  angularVel.yaw   += mouseDelta.yaw;
  mouseDelta.pitch = 0;
  mouseDelta.yaw   = 0;

  // Apply around LOCAL axes
  shipGroup.rotateX(angularVel.pitch);
  shipGroup.rotateY(angularVel.yaw);
  shipGroup.rotateZ(angularVel.roll);

  // Dampen angular velocity
  angularVel.pitch -= angularVel.pitch * SETTINGS.angularDamping * dt;
  angularVel.yaw   -= angularVel.yaw   * SETTINGS.angularDamping * dt;
  angularVel.roll  -= angularVel.roll  * SETTINGS.angularDamping * dt;

  // ---- TRANSLATION (ship-relative) ----
  if (keys["shift"]) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(shipGroup.quaternion);
    velocity.add(fwd.multiplyScalar(SETTINGS.thrust * dt));
    thruster.scale.setScalar(0.9 + Math.random() * 0.5);
  }
  if (keys["control"]) {
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(shipGroup.quaternion);
    velocity.add(back.multiplyScalar(SETTINGS.thrust * dt));
    thruster.scale.setScalar(0.75 + Math.random() * 0.3);
  }
  if (keys["r"]) {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(shipGroup.quaternion);
    velocity.add(up.multiplyScalar(SETTINGS.strafeSpeed * dt));
  }
  if (keys["f"]) {
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
    velocity.add(down.multiplyScalar(SETTINGS.strafeSpeed * dt));
  }
  if (keys["z"]) {
    const left = new THREE.Vector3(-1, 0, 0).applyQuaternion(shipGroup.quaternion);
    velocity.add(left.multiplyScalar(SETTINGS.strafeSpeed * dt));
  }
  if (keys["c"]) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shipGroup.quaternion);
    velocity.add(right.multiplyScalar(SETTINGS.strafeSpeed * dt));
  }

  // Damping + clamp
  velocity.sub(velocity.clone().multiplyScalar(SETTINGS.linearDamping * dt));
  clampSpeed(velocity, SETTINGS.maxSpeed);

  // Move ship
  shipGroup.position.addScaledVector(velocity, dt);

  // Camera follow
  updateCamera();

  // ---- Update bullets ----
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.position.addScaledVector(b.userData.velocity, dt);
    const age = now - b.userData.born;
    if (age > BULLET_LIFETIME || b.position.length() > 2000) {
      scene.remove(b);
      bullets.splice(i, 1);
    }
  }

  // ---- Asteroids: rotate, drift, wrap, collide ----
  for (let i = 0; i < asteroids.length; i++) {
    const a = asteroids[i];
    if (!a.userData.collected) {
      a.rotation.x += a.userData.spin.x * dt;
      a.rotation.y += a.userData.spin.y * dt;
      a.rotation.z += a.userData.spin.z * dt;

      a.position.addScaledVector(a.userData.vel, dt);
      wrapAsteroid(a);

      // Bullet hit test
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (a.position.distanceTo(b.position) < (ASTEROID_RADIUS + BULLET_RADIUS)) {
          a.userData.collected = true;
          a.material.color.set(0x00ff66);

          showMessage(a.userData.text);
          collected.add(a.userData.text);
          updateScore();

          scene.remove(b);
          bullets.splice(j, 1);
          break;
        }
      }
    }
  }

  // Live star size updates if changed
  if (star1Mat) star1Mat.size = SETTINGS.starSizeNear;
  if (star2Mat) star2Mat.size = SETTINGS.starSizeFar;

  renderer.render(scene, camera);
}
animate();

// ======= RESIZE =======
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ======= Settings toggle with Esc =======
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const settings = document.getElementById("settings");
    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
      settings.classList.remove("hidden");
    } else {
      settings.classList.add("hidden");
      document.body.requestPointerLock();
    }
  }
});
