/** @file Renders the accessory thumbnail tray on the left side. */

/**
 * Initialize the tray UI with accessory thumbnails.
 * @param {{accessories: {name: string, thumbnail?: string}[]}} config
 */
export function initTray({ accessories = [] } = {}) {
  const tray = document.getElementById('tray');
  if (!tray) return;

  tray.replaceChildren();
  if (accessories.length === 0) return;

  accessories.forEach((item) => {
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = item.thumbnail || '';
    img.alt = item.name || '';
    img.dataset.objectId = item.name || '';
    img.draggable = false;
    tray.appendChild(img);
  });
}
