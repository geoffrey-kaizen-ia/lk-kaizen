// Nettoie les exports n8n bruts en retirant tout secret, puis ecrit des copies
// versionnables dans docs/n8n/. Les bruts vivent dans .n8n-raw/ (ignore par git).
//
// Usage : node docs/n8n/sanitize.mjs
//
// A chaque modif d'un workflow : re-exporter depuis n8n (menu ... > Download),
// deposer le .json dans .n8n-raw/, relancer ce script, mettre a jour la date
// "Dernier export" dans README.md.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(HERE, '..', '..', '.n8n-raw');
const OUT_DIR = HERE;

// Nom de fichier stable par ID de workflow n8n. Un ID inconnu retombe sur un
// slug derive du champ "name".
const SLUG_BY_ID = {
  wtLJvVIhegJj8szS: 'genere-lien-connexion',
  i8kR9LQwN8S1GPoH: 'unipile-notify-callback',
  '0yQOYs1Ffiqtj4IX': 'icebreaker',
  fsSw8bIknV1cAgKx: 'conversation',
  u9NRd0JkerDhuipM: 'cron-invitations-scraping',
  IBiW7XPBmFjupoWy: 'icebreaker-legacy-airtable',
};

// Secrets connus a caviarder en valeur exacte (cles Unipile tapees en dur).
// Ajouter ici toute nouvelle cle en dur reperee dans un futur export.
const KNOWN_SECRETS = [
  'xS9mVGbY.Mu7uJdL2mWGDERGHJMkh/nDgg/U8qP0/qP5L0Qp/Gjk=',
  'dAANosz/.+IS/3we7AXzq3UEtQRa+UEee31ATckLEBBq6ALqe7MU=',
];

// Tout JWT (service_role, anon, etc.) est caviarde par precaution.
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function slugify(name) {
  return String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sanitize(text) {
  let count = 0;
  let out = text;
  for (const secret of KNOWN_SECRETS) {
    const parts = out.split(secret);
    count += parts.length - 1;
    out = parts.join('___REDACTED_UNIPILE_KEY___');
  }
  out = out.replace(JWT_RE, () => { count += 1; return '___REDACTED_JWT___'; });
  return { out, count };
}

const rawFiles = (await readdir(RAW_DIR).catch(() => [])).filter(f => f.endsWith('.json'));
if (rawFiles.length === 0) {
  console.log(`Aucun .json dans ${RAW_DIR}. Depose les exports n8n bruts dedans puis relance.`);
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });

for (const file of rawFiles) {
  const text = await readFile(join(RAW_DIR, file), 'utf8');
  const { out, count } = sanitize(text);

  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch (e) {
    console.error(`SKIP ${file} : JSON invalide apres nettoyage (${e.message})`);
    continue;
  }

  const slug = SLUG_BY_ID[parsed.id] || slugify(parsed.name || file.replace(/\.json$/, ''));
  const outName = `${slug}.json`;
  await writeFile(join(OUT_DIR, outName), JSON.stringify(parsed, null, 2) + '\n', 'utf8');
  console.log(`OK  ${file} -> ${outName}  (${count} secret(s) caviarde(s), id=${parsed.id})`);
}

console.log('\nVerifie qu il ne reste aucun secret : git diff, puis grep -RnE "eyJ|X-API-KEY" docs/n8n/*.json');
