import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const root=path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints:[path.join(root,'forest-worker.mjs')],
  outfile:path.join(root,'../labs/forest-worker.js'), bundle:true, minify:true,
  platform:'browser', format:'iife', target:'es2020', legalComments:'eof',
  plugins:[{name:'geometry-only',setup(b){
    b.onResolve({filter:/^\.\/textures$/},()=>({path:'textures',namespace:'geometry-only'}));
    b.onLoad({filter:/.*/,namespace:'geometry-only'},()=>({contents:'export const getBarkTexture=()=>null; export const getLeafTexture=()=>null;'}));
  }}]
});
fs.copyFileSync(path.join(root,'node_modules/@dgreenheck/ez-tree/LICENSE'),path.join(root,'../labs/EZ-TREE-LICENSE.txt'));
fs.copyFileSync(path.join(root,'node_modules/three/LICENSE'),path.join(root,'../labs/GENERATOR-THREE-LICENSE.txt'));
console.log('Built geometry-only ez-tree worker (isolated Three.js 0.167.1).');
