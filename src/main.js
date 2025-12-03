/** @file App entrypoint: create scene, load config, and add base model. */
import { Box3, MathUtils, Sphere, Vector3 } from 'three';
import { loadModel } from './loaders.js';
import { createScene } from './scene.js';
import { loadObjectConfig } from './config.js';
import { createInteractionController } from './interaction.js';
import { initTray } from './tray.js';

(async () => {
  const { base, bases, accessories, debug } = await loadObjectConfig();
  const { scene, renderer, camera } = createScene(base.scene);
  const model = await loadModel(scene, base);
  if (!model) {
    console.error('Failed to load base model; aborting scene setup.');
    return;
  }

  const loadedAccessories = await preloadAccessories(scene, accessories);
  initTray({ accessories: loadedAccessories });

  preloadRemainingObjects(scene, bases, accessories, base.name);

  // Fit camera to model with optional portrait scaling
  const baseCameraZ = camera.position.z;
  const fitDistance = fitCameraToModel(camera, model, {
    padding: base.scene?.fitPadding ?? 1.0,
    portraitScale: base.scene?.fitPaddingPortraitScale ?? 1.25
  });
  const adjustedInteraction = scaleZoomRange(base.interaction || {}, baseCameraZ, fitDistance);

  const interactions = createInteractionController(
    model,
    camera,
    renderer.domElement,
    adjustedInteraction,
    debug || {}
  );

  let previousTime = 0;
  renderer.setAnimationLoop((time) => {
    const delta = (time - previousTime) / 1000;
    previousTime = time;

    interactions.update(delta);

    renderer.render(scene, camera);
  });
})();

function preloadRemainingObjects(scene, bases, accessories, displayedBaseName) {
  const remainingBases = bases.filter((entry) => entry.name !== displayedBaseName);
  const remainingObjects = [...remainingBases, ...accessories];
  if (remainingObjects.length === 0) return;

  Promise.allSettled(
    remainingObjects.map((entry) =>
      loadModel(scene, {
        ...entry,
        addToScene: false,
        visible: false
      })
    )
  );
}

async function preloadAccessories(scene, accessories) {
  if (!accessories || accessories.length === 0) return [];

  const results = await Promise.all(
    accessories.map(async (entry) => {
      const model = await loadModel(scene, {
        ...entry,
        addToScene: false,
        visible: false
      });
      return model ? entry : null;
    })
  );

  return results.filter(Boolean);
}

/**
 * Fit the camera distance so the model bounds are in view for the current aspect.
 * @param {import('three').Camera} camera
 * @param {import('three').Object3D} model
 * @param {{padding?: number, portraitScale?: number}} options
 * @returns {number} distance used
 */
function fitCameraToModel(camera, model, options = {}) {
  const padding = options.padding ?? 1.0;
  const portraitScale = options.portraitScale ?? 1.0;

  const box = new Box3().setFromObject(model);
  const sphere = new Sphere();
  box.getBoundingSphere(sphere);
  const aspect = camera.aspect || 1;
  const aspectScale = aspect < 1 ? portraitScale : 1;
  const radius = sphere.radius * padding * aspectScale;
  if (!isFinite(radius) || radius <= 0) {
    return camera.position.z;
  }

  const vFov = MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distV = radius / Math.tan(vFov / 2);
  const distH = radius / Math.tan(hFov / 2);
  const distance = Math.max(distV, distH);

  const center = new Vector3();
  box.getCenter(center);
  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);

  return distance;
}

/**
 * Scale zoom limits relative to a fitted camera distance so aspect changes feel consistent.
 * @param {Object} interaction
 * @param {number} baseDistance
 * @param {number} fitDistance
 * @returns {Object}
 */
function scaleZoomRange(interaction, baseDistance, fitDistance) {
  if (!baseDistance || !fitDistance || !isFinite(baseDistance) || !isFinite(fitDistance)) {
    return interaction;
  }
  const scale = fitDistance / baseDistance;
  if (!isFinite(scale) || scale <= 0) return interaction;

  const next = { ...interaction };
  if (interaction.minZoom != null) next.minZoom = interaction.minZoom * scale;
  if (interaction.maxZoom != null) next.maxZoom = interaction.maxZoom * scale;

  return next;
}
