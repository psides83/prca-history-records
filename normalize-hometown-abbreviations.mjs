import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const inputFile = process.argv[2] ?? path.join('data', 'past-champions.json');
const outputFile = process.argv[3] ?? inputFile;

const abbreviationMap = new Map(
  Object.entries({
    Alabama: 'AL',
    Ala: 'AL',
    Alaska: 'AK',
    Arizona: 'AZ',
    Ariz: 'AZ',
    Arkansas: 'AR',
    Ark: 'AR',
    California: 'CA',
    Calif: 'CA',
    Colorado: 'CO',
    Colo: 'CO',
    Connecticut: 'CT',
    Conn: 'CT',
    Delaware: 'DE',
    Florida: 'FL',
    Fla: 'FL',
    Georgia: 'GA',
    Ga: 'GA',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Ill: 'IL',
    Indiana: 'IN',
    Ind: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kan: 'KS',
    Kentucky: 'KY',
    Ky: 'KY',
    Louisiana: 'LA',
    La: 'LA',
    Maine: 'ME',
    Maryland: 'MD',
    Md: 'MD',
    Massachusetts: 'MA',
    Mass: 'MA',
    Michigan: 'MI',
    Mich: 'MI',
    Minnesota: 'MN',
    Minn: 'MN',
    Mississippi: 'MS',
    Miss: 'MS',
    Missouri: 'MO',
    Mo: 'MO',
    Montana: 'MT',
    Mont: 'MT',
    Nebraska: 'NE',
    Neb: 'NE',
    Nevada: 'NV',
    Nev: 'NV',
    'New Hampshire': 'NH',
    'N.H': 'NH',
    'New Jersey': 'NJ',
    'N.J': 'NJ',
    'New Mexico': 'NM',
    'N.M': 'NM',
    'New York': 'NY',
    'N.Y': 'NY',
    'North Carolina': 'NC',
    'N.C': 'NC',
    'North Dakota': 'ND',
    'N.D': 'ND',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Okla: 'OK',
    Oregon: 'OR',
    Ore: 'OR',
    Pennsylvania: 'PA',
    Penn: 'PA',
    'Rhode Island': 'RI',
    'R.I': 'RI',
    'South Carolina': 'SC',
    'S.C': 'SC',
    'South Dakota': 'SD',
    'S.D': 'SD',
    Tennessee: 'TN',
    Tenn: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    Virginia: 'VA',
    Va: 'VA',
    Washington: 'WA',
    Wash: 'WA',
    Wisconsin: 'WI',
    Wis: 'WI',
    Wyoming: 'WY',
    Wyo: 'WY',
    Alberta: 'AB',
    'British Columbia': 'BC',
    'B.C': 'BC',
    Saskatchewan: 'SK',
    Manitoba: 'MB',
    Ontario: 'ON',
    Quebec: 'QC',
    Queensland: 'QLD',
    Brazil: 'BR',
  }),
);

const normalizeSegment = (segment) => {
  const suffix = segment.match(/\s+(\([^)]*\))$/)?.[1] ?? '';
  const core = segment.replace(/\s+\([^)]*\)$/, '').replace(/\.+$/g, '').trim();
  const normalized = abbreviationMap.get(core) ?? (core.length === 2 || core === 'QLD' ? core.toUpperCase() : core);
  return `${normalized}${suffix ? ` ${suffix}` : ''}`;
};

const normalizeHometown = (hometown) => {
  const parts = hometown.split(',').map((part) => part.trim());
  if (parts.length < 2) return hometown;
  parts[parts.length - 1] = normalizeSegment(parts[parts.length - 1]);
  return parts.join(', ');
};

const records = JSON.parse(await fs.readFile(inputFile, 'utf8'));
for (const record of records) {
  record.hometown = normalizeHometown(record.hometown);
}

await fs.writeFile(outputFile, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Normalized ${records.length} records in ${outputFile}`);
