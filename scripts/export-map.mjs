import {writeFileSync} from 'node:fs';
import {BLOCKS} from '../src/map.js';
writeFileSync(new URL('../art/map.json',import.meta.url),JSON.stringify(BLOCKS));
