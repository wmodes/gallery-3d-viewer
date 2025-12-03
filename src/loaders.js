/** @file Generic loader for scene models based on config. */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const socketRegistry = [];

/**
 * Load a model into the scene using a config-driven path and transforms.
 * @param {import('three').Scene} scene
 * @param {Object} options
 * @param {string} options.modelPath - Path to the GLB asset.
 * @param {number[]} [options.position=[0,0,0]] - XYZ position.
 * @param {number[]} [options.rotation=[0,0,0]] - Euler rotation in radians.
 * @param {number|number[]} [options.scale=1] - Uniform or per-axis scale.
 * @param {boolean} [options.addToScene=true] - Whether to add the model to the scene.
 * @param {boolean} [options.visible=true] - Initial visibility for the model.
 * @param {string} [options.name] - Human-friendly name for logging.
 * @returns {Promise<import('three').Object3D | null>}
 */
export async function loadModel(scene, options = {}) {
  const {
    modelPath,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    addToScene = true,
    visible = true,
    name
  } = options;

  if (!modelPath) {
    throw new Error('modelPath is required to load a model.');
  }

  const label = name || modelPath;

  const assetOk = await preflightAsset(modelPath, label, addToScene);
  if (!assetOk) {
    return null;
  }

  const loader = new GLTFLoader();
  try {
    const glb = await loader.loadAsync(modelPath);
    const model = glb.scene;

    model.position.set(position[0], position[1], position[2]);
    model.rotation.set(rotation[0], rotation[1], rotation[2]);

    if (Array.isArray(scale)) {
      model.scale.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1);
    } else {
      model.scale.set(scale, scale, scale);
    }

    model.visible = visible;

    if (addToScene && scene) {
      scene.add(model);
    }
    collectSockets(model, label);
    console.info(`Loaded model "${label}" from ${modelPath}`);
    return model;
  } catch (error) {
    console.warn(`WARNING: Failed to load model "${label}" from ${modelPath}: ${error?.message || error}`);

    // For primary loads we still fail fast; preloads can continue without a hard error.
    if (addToScene) {
      throw error;
    }
    return null;
  }
}

/**
 * Get the current socket registry.
 * @returns {{objectId: string, socketId: string, threeJsNode: import('three').Object3D}[]}
 */
export function getSocketRegistry() {
  return socketRegistry;
}

async function preflightAsset(modelPath, label, addToScene) {
  try {
    const response = await fetch(modelPath, { method: 'HEAD' });
    if (!response.ok) {
      console.warn(
        `WARNING: Model "${label}" not found at ${modelPath} (HTTP ${response.status} ${response.statusText})`
      );
      if (addToScene) throw new Error(`Missing model at ${modelPath}`);
      return false;
    }

    const contentType = response.headers.get('content-type') || '';
    const looksLikeGlb =
      contentType.toLowerCase().includes('model/gltf-binary') ||
      contentType.toLowerCase().includes('application/octet-stream');
    if (!looksLikeGlb) {
      console.warn(
        `WARNING: Model "${label}" at ${modelPath} has unexpected content-type "${contentType}" (expected GLB)`
      );
      if (addToScene) throw new Error(`Unexpected content-type ${contentType} for ${modelPath}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      `WARNING: Could not verify model "${label}" at ${modelPath}: ${error?.message || error}`
    );
    if (addToScene) throw error;
    return false;
  }
}

function collectSockets(model, objectId) {
  // Remove stale entries for this objectId before adding new ones.
  for (let i = socketRegistry.length - 1; i >= 0; i -= 1) {
    if (socketRegistry[i].objectId === objectId) {
      socketRegistry.splice(i, 1);
    }
  }

  const sockets = [];
  model.traverse((node) => {
    if (!node?.name || typeof node.name !== 'string') return;
    if (!node.name.startsWith('socket_')) return;
    sockets.push({ objectId, socketId: node.name, threeJsNode: node });
  });

  socketRegistry.push(...sockets);
  if (sockets.length > 0) {
    console.info(
      `Discovered ${sockets.length} sockets on "${objectId}": ${sockets
        .map((s) => s.socketId)
        .join(', ')}`
    );
  }
}
