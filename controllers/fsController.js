const fs = require('fs');
const path = require('path');

const publicRoot = path.join(__dirname, '..', 'public');

exports.listDirectory = (req, res) => {
  const relPath = req.query.path || '/';
  const safePath = path.normalize(path.join(publicRoot, relPath));

  // Prevent directory traversal attacks
  if (!safePath.startsWith(publicRoot)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (fs.existsSync(safePath)) {
    const stat = fs.lstatSync(safePath);
    if (stat.isDirectory()) {
      try {
        const entries = fs.readdirSync(safePath, { withFileTypes: true })
          .map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'dir' : 'file'
          }));

        console.log(`Listed directory: ${relPath}`);
        res.json({ path: relPath, entries });
      } catch {
        console.error(`Failed to list directory: ${relPath}`);
        res.status(404).json({ error: 'Directory not found' });
      }
    } else if (stat.isFile()) {
      console.log(`Accessed file: ${relPath}`);
      res.json({ path: relPath, file: path.basename(safePath) });
    } else {
      console.error(`Not a file or directory: ${relPath}`);
      res.status(400).json({ error: 'Not a file or directory' });
    }
  } else {
    console.error(`Path not found: ${relPath}`);
    res.status(404).json({ error: 'Path not found' });
  }
};
