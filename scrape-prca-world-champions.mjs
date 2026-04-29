import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright';

const URL = 'https://www.prorodeo.com/prorodeo/cowboys/world-champions-historical/';
const DEFAULT_OUTPUT = path.join('data', 'world-champions-historical.json');

const args = new Set(process.argv.slice(2));
const getArgValue = (name, fallback) => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const headed = args.has('--headed') || args.has('--manual');
const manual = args.has('--manual');
const outputFile = getArgValue('--output', DEFAULT_OUTPUT);
const profileDir = getArgValue('--profile', path.join('.auth', 'prorodeo-browser-profile'));

async function main() {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: !headed,
    viewport: { width: 1440, height: 1000 },
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    if (await isBlocked(page)) {
      if (!manual) {
        throw new Error(
          'PRCA returned a bot-protection page. Run `npm run scrape:headed`, solve the browser challenge, then press Enter in the terminal.',
        );
      }

      console.log('PRCA is showing a browser verification challenge.');
      console.log('Complete it in the opened browser window, wait for the world champions page to load, then press Enter here.');
      await waitForEnter();
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    }

    await waitForHistoricalContent(page);

    const records = await page.evaluate(extractWorldChampions);
    if (!records.length) {
      await writeDebugPage(page);
      throw new Error('No champion records were found on the rendered page.');
    }

    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, `${JSON.stringify(records, null, 2)}\n`);

    console.log(`Wrote ${records.length} records to ${outputFile}`);
  } finally {
    await context.close();
  }
}

async function isBlocked(page) {
  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
  const frameCount = await page.locator('iframe[src*="hcaptcha"], iframe#main-iframe').count().catch(() => 0);
  return /Incapsula|Request unsuccessful|hcaptcha|browser verification/i.test(bodyText) || frameCount > 0;
}

async function waitForEnter() {
  const rl = createInterface({ input, output });
  await rl.question('');
  rl.close();
}

async function waitForHistoricalContent(page) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? '';
      const hasTables = document.querySelectorAll('table tr').length > 1;
      const hasChampionWords = /world champions|all-around|bareback|bull riding|saddle bronc/i.test(text);
      return hasTables || hasChampionWords;
    },
    null,
    { timeout: 60_000 },
  );
}

async function writeDebugPage(page) {
  const debugDir = path.join('debug');
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(path.join(debugDir, 'rendered-page.txt'), await page.locator('body').innerText().catch(() => ''));
  await fs.writeFile(path.join(debugDir, 'rendered-page.html'), await page.content().catch(() => ''));
  console.error(`Saved rendered page debug files to ${debugDir}/`);
}

function extractWorldChampions() {
  const eventNames = [
    'All Around',
    'Bareback Riding',
    'Steer Wrestling',
    'Team Roping Header',
    'Team Roping Heeler',
    'Saddle Bronc Riding',
    'Tie-Down Roping',
    'Steer Roping',
    'Bull Riding',
    'Barrel Racing',
    'Breakaway Roping',
  ];

  const clean = (value) =>
    String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .trim();

  const simplify = (value) =>
    clean(value)
      .replace(/\b(world\s+)?champions?\b/gi, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/gi, '')
      .toLowerCase();

  const eventAliases = new Map();
  for (const eventName of eventNames) {
    eventAliases.set(simplify(eventName), eventName);
  }
  eventAliases.set('allaround', 'All Around');
  eventAliases.set('allaroundcowboy', 'All Around');
  eventAliases.set('calfroping', 'Tie-Down Roping');
  eventAliases.set('tiedown', 'Tie-Down Roping');
  eventAliases.set('teamropingheading', 'Team Roping Header');
  eventAliases.set('teamropingheeling', 'Team Roping Heeler');

  const eventFromLine = (value) => eventAliases.get(simplify(value)) ?? '';
  const normalizeEvent = (value) => eventFromLine(value) || clean(value).replace(/^All-Around$/i, 'All Around');

  const normalizeHeader = (value) => {
    const normalized = clean(value).toLowerCase();
    if (/^year$/.test(normalized)) return 'year';
    if (/athlete|cowboy|champion|contestant|name|winner/.test(normalized)) return 'athlete';
    if (/hometown|residence|city|state/.test(normalized)) return 'hometown';
    if (/country/.test(normalized)) return 'country';
    if (/event|category/.test(normalized)) return 'event';
    return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  };

  const closestEventName = (node) => {
    let cursor = node;
    for (let i = 0; i < 10 && cursor; i += 1) {
      let previous = cursor.previousElementSibling;
      while (previous) {
        const text = clean(previous.innerText);
        const matched = eventFromLine(text);
        if (matched) return matched;
        if (/champions?$/i.test(text) && text.length < 80) return text.replace(/\s+Champions?$/i, '');
        previous = previous.previousElementSibling;
      }
      cursor = cursor.parentElement;
    }

    const tableText = clean(node.innerText);
    return eventNames.find((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(tableText)) ?? '';
  };

  const normalizeRecord = (record) => {
    const year = String(record.year ?? '').match(/\b(18|19|20)\d{2}\b/)?.[0] ?? '';
    const athlete = clean(record.athlete ?? record.champion ?? record.name ?? record.winner);
    const event = normalizeEvent(record.event);
    if (!event || !year || !athlete) return null;

    return {
      year,
      event,
      athlete,
      hometown: clean(record.hometown),
    };
  };

  const tableRecords = Array.from(document.querySelectorAll('table')).flatMap((table) => {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) return [];

    const headerCells = Array.from(rows[0].querySelectorAll('th,td')).map((cell) => normalizeHeader(cell.innerText));
    const event = headerCells.includes('event') ? '' : closestEventName(table);

    return rows.slice(1).map((row) => {
      const cells = Array.from(row.querySelectorAll('td,th')).map((cell) => clean(cell.innerText));
      if (cells.length < 2) return null;

      const record = { event, raw: cells.join(' | ') };
      cells.forEach((cell, index) => {
        const key = headerCells[index] || `column_${index + 1}`;
        record[key] = cell;
      });

      if (!record.year && /^\d{4}$/.test(cells[0])) {
        record.year = cells[0];
        record.athlete = cells[1];
        record.hometown = cells[2] ?? '';
      }

      return normalizeRecord(record);
    });
  });

  const textRecords = [];
  let currentEvent = '';
  const lines = clean(document.body.innerText)
    .split('\n')
    .map(clean)
    .filter(Boolean);

  const isYear = (value) => /^(18|19|20)\d{2}$/.test(clean(value));
  const isSkippedTextLine = (value) =>
    /^(year|athlete|cowboy|champion|contestant|winner|name|hometown|home town|event|country|select event|world champions historical|world champions \(historical\))$/i.test(clean(value));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const event = eventFromLine(line);
    if (event) {
      currentEvent = event;
      continue;
    }

    const match = line.match(/\b((?:18|19|20)\d{2})\b\s+[-~|:]?\s+(.+)/);
    if (!currentEvent || !match) continue;

    const [, year, rest] = match;
    const parts = rest.split(/\s+[|~]\s+|\s{2,}| - /).map(clean).filter(Boolean);
    textRecords.push(
      normalizeRecord({
        event: currentEvent,
        year,
        athlete: parts[0] ?? rest,
        hometown: parts[1] ?? '',
      }),
    );
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const event = eventFromLine(line);
    if (event) {
      currentEvent = event;
      continue;
    }

    if (!isYear(line)) continue;

    let recordEvent = currentEvent;
    const fields = [];

    for (let next = index + 1; next < lines.length && fields.length < 3; next += 1) {
      const candidate = lines[next];
      const candidateEvent = eventFromLine(candidate);
      if (candidateEvent) {
        if (!recordEvent) {
          recordEvent = candidateEvent;
          continue;
        }
        break;
      }
      if (isYear(candidate)) break;
      if (isSkippedTextLine(candidate)) continue;
      fields.push(candidate);
    }

    textRecords.push(
      normalizeRecord({
        event: recordEvent,
        year: line,
        athlete: fields[0] ?? '',
        hometown: fields[1] ?? '',
      }),
    );
  }

  const unique = new Map();
  for (const record of [...tableRecords, ...textRecords].filter(Boolean)) {
    const key = `${record.event}|${record.year}|${record.athlete}|${record.hometown}`;
    unique.set(key, record);
  }

  return Array.from(unique.values()).sort((a, b) => {
    const eventSort = a.event.localeCompare(b.event);
    if (eventSort) return eventSort;
    return Number(b.year) - Number(a.year) || a.athlete.localeCompare(b.athlete);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
