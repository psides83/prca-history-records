# PRCA Historical World Champions Scraper

Scrapes PRCA's historical world champions page into JSON:

```json
{
  "year": "1929",
  "event": "All Around",
  "athlete": "Earl Thode",
  "hometown": "Belvidere, S.D."
}
```

## Setup

```sh
npm install
npx playwright install chromium
```

## Run

The PRCA page may show browser verification. Use headed mode so you can complete it:

```sh
npm run scrape:headed
```

After the page loads, press Enter in the terminal. The scraper writes:

```text
data/world-champions-historical.json
```

You can also set a custom output path:

```sh
npm run scrape:headed -- --output=data/prca-world-champions.json
```
