/** @file Scene factory that applies defaults from config. */
import * as THREE from 'three';

const defaultSceneConfig = {
  background: '#eeeeee',
  camera: { fov: 50, position: [0, 0, 5] },
  lights: {
    directional: { color: '#ffffff', intensity: 1.0, position: [3, 5, 2] },
    ambient: { color: '#ffffff', intensity: 0.4 }
  }
};

/**
 * Create a Three.js scene with values merged from config.
 * @param {Object} [sceneConfig]
 * @returns {{scene: import('three').Scene, camera: import('three').Camera, renderer: import('three').WebGLRenderer}}
 */
export function createScene(sceneConfig = {}) {
  const background = sceneConfig.background ?? defaultSceneConfig.background;
  const cameraConfig = {
    ...defaultSceneConfig.camera,
    ...(sceneConfig.camera || {})
  };
  const lightsConfig = {
    directional: {
      ...defaultSceneConfig.lights.directional,
      ...(sceneConfig.lights?.directional || {})
    },
    ambient: {
      ...defaultSceneConfig.lights.ambient,
      ...(sceneConfig.lights?.ambient || {})
    }
  };

  const canvas = document.getElementById('app');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(
    cameraConfig.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(
    cameraConfig.position?.[0] ?? 0,
    cameraConfig.position?.[1] ?? 0,
    cameraConfig.position?.[2] ?? 5
  );

  const directional = new THREE.DirectionalLight(
    lightsConfig.directional.color,
    lightsConfig.directional.intensity
  );
  directional.position.set(
    lightsConfig.directional.position?.[0] ?? 3,
    lightsConfig.directional.position?.[1] ?? 5,
    lightsConfig.directional.position?.[2] ?? 2
  );
  scene.add(directional);

  const ambient = new THREE.AmbientLight(
    lightsConfig.ambient.color,
    lightsConfig.ambient.intensity
  );
  scene.add(ambient);

  function onResize() {
    const { innerWidth, innerHeight } = window;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener('resize', onResize);
  onResize();

  return { scene, camera, renderer };
}
