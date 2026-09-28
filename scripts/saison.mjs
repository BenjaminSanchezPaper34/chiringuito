/**
 * saison.mjs — bascule le site entre la saison et l'hiver.
 *
 *   node scripts/saison.mjs hiver    fermeture : réservations masquées, bandeaux d'hiver visibles
 *   node scripts/saison.mjs ouvert   réouverture : tout revient
 *
 * Le script ne touche qu'à l'attribut data-saison de la balise <html> des pages
 * concernées ; la logique d'affichage vit dans css/tailwind.src.css.
 * À la réouverture, penser aussi aux dates (FAQ, llms.txt, schéma horaires) et
 * à rouvrir les créneaux dans Zenchef.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  'index.html',
  'reserver/index.html',
  'reserver/table/index.html',
  'reserver/bain-de-soleil/index.html',
  'carte/index.html',
  'carte/apres-midi/index.html',
  'boissons/index.html'
];

const mode = process.argv[2];
if (!['hiver', 'ouvert'].includes(mode)) {
  console.error('Usage : node scripts/saison.mjs hiver|ouvert');
  process.exit(1);
}

for (const rel of PAGES) {
  const f = path.join(ROOT, rel);
  let html = await fs.readFile(f, 'utf8');
  const avant = html;
  // On ne vise que la vraie balise racine : la premiere <html ...>, jamais une mention
  // dans un commentaire ou un texte plus loin dans la page.
  const tag = html.match(/<html\b[^>]*>/i);
  if (!tag) throw new Error(`balise <html> introuvable dans ${rel}`);
  const nouveau = /\sdata-saison="[^"]*"/.test(tag[0])
    ? tag[0].replace(/(\sdata-saison=")[^"]*(")/, `$1${mode}$2`)
    : tag[0].replace(/^<html\b/i, `<html data-saison="${mode}"`);
  html = html.slice(0, tag.index) + nouveau + html.slice(tag.index + tag[0].length);
  await fs.writeFile(f, html, 'utf8');
  console.log(`${html === avant ? '=' : '✓'} ${rel} → ${mode}`);
}
