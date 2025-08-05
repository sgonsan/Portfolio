const fs = require('fs');
const path = require('path');

const PUBLIC_PATH = path.join(__dirname, '../public');

// Cache
let cachedTree = null;
let lastUpdate = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Recursively build the file system tree
function buildTree(dir, base = '') {
  const result = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const relativePath = path.join(base, item.name);
    if (item.isDirectory()) {
      result.push({
        name: item.name,
        type: 'dir',
        children: buildTree(path.join(dir, item.name), relativePath)
      });
    } else {
      result.push({
        name: item.name,
        type: 'file'
      });
    }
  }

  return result;
}

exports.getFileSystem = (req, res) => {
  const now = Date.now();

  // Check if the cache is still valid
  if (cachedTree && now - lastUpdate < CACHE_DURATION) {
    console.log('Returning cached file system tree');
    return res.json(cachedTree);
  }

  // If cache is invalid or doesn't exist, rebuild the tree
  try {
    cachedTree = buildTree(PUBLIC_PATH);
    lastUpdate = now;
    console.log('File system tree rebuilt');
    res.json(cachedTree);
  } catch (err) {
    console.error('Error building filesystem tree:', err);
    res.status(500).json({ error: 'Failed to build filesystem tree' });
  }
};
