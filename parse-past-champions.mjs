import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const inputFile = process.argv[2] ?? path.join('data', 'past-champions.txt');
const outputFile = process.argv[3] ?? path.join('data', 'past-champions.json');

const eventHeadings = new Map([
  ['all-around', 'All Around'],
  ['all around', 'All Around'],
  ['bareback riding', 'Bareback Riding'],
  ['saddle bronc riding', 'Saddle Bronc Riding'],
  ['steer wrestling', 'Steer Wrestling'],
  ['team roping', 'Team Roping'],
  ['tie-down roping', 'Tie-Down Roping'],
  ['tie down roping', 'Tie-Down Roping'],
  ['bull riding', 'Bull Riding'],
  ['steer roping', 'Steer Roping'],
]);

const clean = (value) =>
  String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

const normalizeHeading = (line) =>
  clean(line)
    .replace(/\s+past\s+world\s+rodeo\s+champions$/i, '')
    .replace(/\s+past\s+world\s+champions$/i, '')
    .replace(/\s+world\s+rodeo\s+champions$/i, '')
    .replace(/-/g, ' ')
    .toLowerCase();

const parseLine = (line, event) => {
  const match = clean(line).match(/^([^,]+),\s+(.+?)\s+((?:18|19|20)\d{2})$/);
  if (!match) return null;

  const [, athlete, hometown, year] = match;
  return {
    year,
    event,
    athlete: clean(athlete),
    hometown: clean(hometown),
  };
};

const text = await fs.readFile(inputFile, 'utf8');
const records = [];
const skipped = [];
let currentEvent = '';

for (const rawLine of text.split(/\r?\n/)) {
  const line = clean(rawLine);
  if (!line) continue;

  const heading = eventHeadings.get(normalizeHeading(line));
  if (heading) {
    currentEvent = heading;
    continue;
  }

  if (!currentEvent) continue;

  const record = parseLine(line, currentEvent);
  if (record) {
    records.push(record);
  } else if (/\b(?:18|19|20)\d{2}\b/.test(line)) {
    skipped.push(line);
  }
}

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(records, null, 2)}\n`);

console.log(`Wrote ${records.length} records to ${outputFile}`);
if (skipped.length) {
  console.warn(`Skipped ${skipped.length} year-like lines:`);
  for (const line of skipped) console.warn(`- ${line}`);
}
