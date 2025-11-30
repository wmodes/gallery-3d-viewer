/** @file Generic loader for scene models based on config. */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Load a model into the scene using a config-driven path and transforms.
 * @param {import('three').Scene} scene
 * @param {Object} options
 * @param {string} options.modelPath - Path to the GLB asset.
 * @param {number[]} [options.position=[0,0,0]] - XYZ position.
 * @param {number[]} [options.rotation=[0,0,0]] - Euler rotation in radians.
 * @param {number|number[]} [options.scale=1] - Uniform or per-axis scale.
 * @returns {Promise<import('three').Object3D>}
 */
export async function loadModel(scene, options = {}) {
  const {
    modelPath,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1
  } = options;

  if (!modelPath) {
    throw new Error('modelPath is required to load a model.');
  }

  const loader = new GLTFLoader();
  const glb = await loader.loadAsync(modelPath);
  const model = glb.scene;

  model.position.set(position[0], position[1], position[2]);
  model.rotation.set(rotation[0], rotation[1], rotation[2]);

  if (Array.isArray(scale)) {
    model.scale.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1);
  } else {
    model.scale.set(scale, scale, scale);
  }

  scene.add(model);
  return model;
}
