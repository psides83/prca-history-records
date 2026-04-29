import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const inputFile = process.argv[2] ?? path.join('data', 'past-champions.json');
const outputFile = process.argv[3] ?? inputFile;

const records = JSON.parse(await fs.readFile(inputFile, 'utf8'));
let headingCount = 0;
let heelingCount = 0;

for (const record of records) {
  if (record.event !== 'Team Roping') continue;

  if (/\(hdr\)/i.test(record.athlete)) {
    record.event = 'Team Roping: Heading';
    record.athlete = record.athlete.replace(/\s*\(hdr\)\s*/i, '').trim();
    headingCount += 1;
  } else if (/\(hlr\)/i.test(record.athlete)) {
    record.event = 'Team Roping: Heeling';
    record.athlete = record.athlete.replace(/\s*\(hlr\)\s*/i, '').trim();
    heelingCount += 1;
  }
}

await fs.writeFile(outputFile, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Updated ${headingCount} heading records and ${heelingCount} heeling records in ${outputFile}`);
