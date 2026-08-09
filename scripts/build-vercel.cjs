const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDist = path.join(root, 'public-web', 'dist');
const adminSource = path.join(root, 'admin-web');
const output = path.join(root, 'dist-web');
const adminOutput = path.join(output, 'gennetex', 'admin');

if (!fs.existsSync(publicDist)) {
  throw new Error('public-web/dist is missing. Run the public-web build first.');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(publicDist, output, { recursive: true });

if (!fs.existsSync(adminSource)) {
  throw new Error('admin-web is missing.');
}

fs.mkdirSync(path.dirname(adminOutput), { recursive: true });
fs.cpSync(adminSource, adminOutput, { recursive: true });

console.log(`Vercel output prepared at ${output}`);
