const fs = require('fs');
const path = require('path');
const pjson = require('./package.json');
const deps = Object.keys(pjson.dependencies || {});
const builtins = require('module').builtinModules;

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, filesList);
    } else if (name.endsWith('.js')) {
      filesList.push(name);
    }
  }
  return filesList;
}

const jsFiles = getFiles('./backend/src');
const missing = new Set();
const regex = /(?:import.*from\s+['"]|require\(['"])([^/.'"][^'"]*)/g;

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    let pkg = match[1];
    if (pkg.startsWith('@')) {
      pkg = pkg.split('/').slice(0, 2).join('/');
    } else {
      pkg = pkg.split('/')[0];
    }
    if (!builtins.includes(pkg) && !deps.includes(pkg)) {
      missing.add(pkg);
    }
  }
}
console.log('Missing explicit dependencies:', Array.from(missing));
