import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {csvUpdateText} from '../app/csv-updates.ts';
const directory=path.resolve(process.argv[2]||path.dirname(fileURLToPath(import.meta.url)));
await fs.mkdir(directory,{recursive:true});
await fs.writeFile(path.join(directory,'equipment_updates_template.csv'),csvUpdateText([]),'utf8');
console.log('Exported equipment_updates_template.csv');
