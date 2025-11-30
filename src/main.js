/** @file App entrypoint: create scene, load config, and add base model. */
import { loadModel } from './loaders.js';
import { createScene } from './scene.js';
import { loadObjectConfig } from './config.js';
import { createInteractionController } from './interaction.js';

(async () => {
  const { base, debug } = await loadObjectConfig();
  const { scene, renderer, camera } = createScene(base.scene);
  const model = await loadModel(scene, base);
  const interactions = createInteractionController(
    model,
    camera,
    renderer.domElement,
    base.interaction || {},
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
