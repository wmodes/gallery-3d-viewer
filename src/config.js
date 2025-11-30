/** @file Loads and normalizes object configuration from HJSON. */
import HJSON from 'hjson';

/**
 * Fetch and parse the object configuration from the public config folder.
 * @returns {Promise<{base: Record<string, any>, accessories: Record<string, any>[], debug: Record<string, any>}>}
 */
export async function loadObjectConfig() {
  const response = await fetch('/config/objects.hjson');
  if (!response.ok) {
    throw new Error(`Failed to load object config: ${response.status} ${response.statusText}`);
  }

  const rawText = await response.text();
  const parsed = HJSON.parse(rawText);

  const objects = parsed?.objects ?? {};
  const defaults = objects.default ?? {};
  const debug = parsed?.debug ?? {};

  const objectEntries = Object.entries(objects)
    .filter(([name]) => name !== 'default')
    .map(([name, value]) => ({ name, ...value }));

  const baseObjects = objectEntries.filter((entry) => entry?.objClass === 'base');
  const accessories = objectEntries.filter((entry) => entry?.objClass === 'accessory');

  if (baseObjects.length === 0) {
    throw new Error('No base object found in configuration.');
  }

  const selectedBase = baseObjects[0];
  const mergedScene = {
    ...(defaults.scene || {}),
    ...(selectedBase.scene || {})
  };
  const base = { ...defaults, ...selectedBase, scene: mergedScene };

  return { base, accessories, debug };
}
