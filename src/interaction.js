/** @file Basic interaction controller for model rotation and zoom (stubs for future features). */

/**
 * Create an interaction controller for a model.
 * @param {import('three').Object3D} model
 * @param {import('three').Camera} camera
 * @param {HTMLElement} canvas
 * @param {Object} interactionConfig
 * @param {number} interactionConfig.spinAcceleration
 * @param {number} interactionConfig.spinFriction
 * @param {number} interactionConfig.idleSpinImpulse
 * @param {number} [interactionConfig.minZoom]
 * @param {number} [interactionConfig.maxZoom]
 * @param {number} [interactionConfig.zoomSpeed]
 * @param {number} [interactionConfig.pinchZoomMultiplier]
 * @param {number} [interactionConfig.xAxisMultiplier]
 * @param {number} [interactionConfig.yAxisMultiplier]
 * @param {number} [interactionConfig.minAngularSpeed]
 * @param {number} [interactionConfig.initialYawSpin]
 * @param {number} [interactionConfig.uprightStrength]
 * @param {number} [interactionConfig.uprightThreshold]
 * @param {Object} [debugConfig]
 * @param {boolean} [debugConfig.interactions=false]
 * @returns {{update: (delta: number) => void, dispose: () => void}}
 */
export function createInteractionController(
  model,
  camera,
  canvas,
  interactionConfig = {},
  debugConfig = {}
) {
  const {
    spinAcceleration = 2.0,
    spinFriction = 0.3,
    idleSpinImpulse = 0.2,
    minZoom = 2,
    maxZoom = 12,
    zoomSpeed = 0.002,
    pinchZoomMultiplier = 4,
    xAxisMultiplier = 0.6,
    yAxisMultiplier = 1.0,
    minAngularSpeed = 0.0,
    initialYawSpin = 0.0,
    uprightStrength = 0.0,
    uprightThreshold = 0.0
  } = interactionConfig;
  const { interactions: debugInteractions = false } = debugConfig;

  const debugLog = (...args) => {
    if (debugInteractions) {
      // eslint-disable-next-line no-console
      console.log('[interaction]', ...args);
    }
  };

  // Internal state
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastMoveTime = 0;
  let velocityX = 0;
  let velocityY = 0;
  let coasting = true;
  let zoomDistance = camera.position.z;

  // Idle spin: give a gentle initial impulse
  velocityX = idleSpinImpulse;
  // Add optional initial yaw spin that follows the same friction rules
  velocityX += initialYawSpin;
  debugLog('idle spin impulse applied', { velocityX });

  function onPointerDown(event) {
    isDragging = true;
    coasting = false;
    const { clientX, clientY } = getPoint(event);
    lastX = clientX;
    lastY = clientY;
    lastMoveTime = event.timeStamp || performance.now();
    debugLog('pointerdown', { x: clientX, y: clientY });
  }

  function onPointerMove(event) {
    if (!isDragging) return;
    const { clientX, clientY } = getPoint(event);
    const dx = clientX - lastX;
    const dy = clientY - lastY;
    lastX = clientX;
    lastY = clientY;
    const now = event.timeStamp || performance.now();
    const dtMs = Math.max(now - lastMoveTime, 1);
    const dtSeconds = dtMs / 1000;
    lastMoveTime = now;

    const accel = spinAcceleration * 0.002;
    const rotY = dx * accel * yAxisMultiplier;
    const rotX = dy * accel * xAxisMultiplier;

    // Immediate rotation feedback while dragging
    model.rotation.y += rotY;
    model.rotation.x += rotX;

    // Set angular velocity for inertial spin after release
    const safeDt = Math.max(dtSeconds, 0.001);
    velocityX = rotY / safeDt; // rad/s matching final gesture speed
    velocityY = rotX / safeDt;

    debugLog('pointermove', { dx, dy, rotX, rotY, dtMs, velocityX, velocityY });
  }

  function onPointerUp() {
    isDragging = false;
    const minSpeed = Math.max(minAngularSpeed, 0);
    const speedMag = Math.max(Math.abs(velocityX), Math.abs(velocityY));
    coasting = speedMag >= minSpeed;
    if (!coasting) {
      velocityX = 0;
      velocityY = 0;
    }
    debugLog('pointerup');
  }

  function onWheel(event) {
    event.preventDefault();
    const isPinchLike = event.ctrlKey === true || event.deltaMode === 1;
    const effectiveSpeed = isPinchLike ? zoomSpeed * pinchZoomMultiplier : zoomSpeed;
    const zoomDelta = event.deltaY * effectiveSpeed;
    zoomDistance = clamp(zoomDistance + zoomDelta, minZoom, maxZoom);
    camera.position.set(camera.position.x, camera.position.y, zoomDistance);
    debugLog('wheel', { deltaY: event.deltaY, zoomDistance, isPinchLike, effectiveSpeed });
  }

  function getPoint(event) {
    if (event.touches && event.touches.length > 0) {
      return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    return { clientX: event.clientX, clientY: event.clientY };
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  debugLog('listeners attached');

  function update(delta) {
    // Apply angular velocity to model (yaw/pitch)
    model.rotation.y += velocityX * delta;
    model.rotation.x += velocityY * delta;
    // Lock roll; no changes to model.rotation.z

    // Apply friction to angular velocity
    const frictionClamped = clamp(spinFriction, 0, 1);
    // Frame-rate–independent damping: friction applied per second
    const damping = Math.pow(1 - frictionClamped, delta); // friction=1 -> stop, friction=0 -> never stop
    velocityX *= damping;
    velocityY *= damping;

    // Gentle self-righting near the floor while coasting
    const speedMag = Math.max(Math.abs(velocityX), Math.abs(velocityY));
    const minSpeed = Math.max(minAngularSpeed, 0);
    const uprightKickIn = Math.max(uprightThreshold, minSpeed);
    const uprightActive = coasting && uprightStrength > 0 && speedMag <= uprightKickIn;
    if (uprightActive) {
      const uprightDamping = Math.exp(-uprightStrength * delta);
      velocityY *= uprightDamping;
      const angleX = normalizeAngle(model.rotation.x);
      const correction = -angleX * uprightStrength * delta;
      velocityY += correction;
      if (Math.abs(velocityY) < 1e-5) velocityY = 0;
    }

    // Clamp to minimum angular speed while coasting; allow user to stop below the floor
    if (coasting && minSpeed > 0) {
      if (Math.abs(velocityX) < minSpeed) velocityX = Math.sign(velocityX) * minSpeed;
      if (!uprightActive && Math.abs(velocityY) < minSpeed) {
        velocityY = Math.sign(velocityY) * minSpeed;
      }
    }

    // When not coasting, allow the velocity to decay to zero without enforcing the floor
    if (!coasting && !isDragging && minSpeed > 0) {
      if (Math.abs(velocityX) < minSpeed) velocityX = 0;
      if (Math.abs(velocityY) < minSpeed) velocityY = 0;
    }
  }

  function dispose() {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  }

  return { update, dispose };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  // Normalize to [-PI, PI] to find the shortest path to upright
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
