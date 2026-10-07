const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('@babel/core');

module.exports = function createLoader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(filename) {
    const resolved = path.resolve(filename);
    if (cache.has(resolved)) return cache.get(resolved);
    const exports = {};
    cache.set(resolved, exports);
    const code = transformSync(fs.readFileSync(resolved, 'utf8'), {
      filename: resolved, configFile: false, babelrc: false,
      plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
    }).code;
    vm.runInNewContext(code, { exports, console, Date, setTimeout, clearTimeout, ...globals,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.startsWith('.')) {
          const file = path.resolve(path.dirname(resolved), name);
          return load(path.extname(file) ? file : `${file}.js`);
        }
        throw Error(`Unmocked dependency: ${name}`);
      },
    }, { filename: resolved });
    return exports;
  }
  return load;
};
