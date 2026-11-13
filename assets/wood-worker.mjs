// Paints the shared wood sheet off the main thread (see prepareWood in wood-sheet.mjs).
import {woodPixels} from './wood-sheet.mjs';
const sheet=woodPixels();
postMessage(sheet,[sheet.col.buffer,sheet.nrm.buffer]);
