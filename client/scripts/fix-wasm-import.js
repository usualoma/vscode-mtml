const fs = require("fs");

const name = process.argv[2];
const content = fs.readFileSync(name).toString().replace(
  "import * as wasm from './mtml_parser_bg.wasm';",
  `import initWasm from './mtml_parser_bg.wasm';
import * as mtml_parser_bg from "./mtml_parser_bg.js";
const wasm = initWasm(
  {
    "./mtml_parser_bg.js": mtml_parser_bg,
  }
).exports;`);
fs.writeFileSync(name, content);
