/**
 * update-reviews.mjs — recupere les avis Zenchef et les ecrit EN DUR dans index.html.
 *
 * Pourquoi un rendu statique plutot qu'un widget : le bloc Elfsight actuel vit
 * dans un iframe, donc son texte est invisible pour Google et pour les IA. Des
 * avis ecrits dans le HTML sont des passages indexables et citables, sans script
 * tiers, sans consentement a demander et sans cout de chargement.
 *
 * Endpoint utilise : /restaurants/{id}/reviews — il ne renvoie AUCUNE donnee
 * personnelle (ni email, ni nom, ni sexe). Ne jamais basculer sur /reviews pour
 * un affichage public : celui-la contient l'identite des clients.
 *
 * Usage :
 *   ZENCHEF_AUTH_TOKEN=xxx node scripts/update-reviews.mjs
 *   ZENCHEF_AUTH_TOKEN=xxx node scripts/update-reviews.mjs --dry-run
 *
 * Le token est lie au profil utilisateur Zenchef et expire si le mot de passe
 * change. Un utilisateur API dedie avec token stable est a demander a
 * api-tech-help@zenchef.com avant de dependre de ce script en automatique.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'avis-zenchef.json');

const HOST = 'https://api.zenchef.com/api/v1';
const RESTAURANT_ID = process.env.ZENCHEF_RESTAURANT_ID || '360974';
const TOKEN = process.env.ZENCHEF_AUTH_TOKEN;

const PAGES_A_SCANNER = 40;   // ~400 avis les plus recents
const NB_AFFICHES = 6;
const LONGUEUR_MIN = 80;      // sous ce seuil l'avis n'apporte rien a lire
const LONGUEUR_MAX = 340;     // au-dela il casse la grille

/* Une note de 5 ne garantit pas un texte elogieux : des clients mettent 5
   partout puis signalent un probleme dans le commentaire. On ecarte donc les
   textes qui portent une reserve explicite. Ce mur est une selection de
   temoignages, pas un miroir de tous les avis — la note reelle et les 3 849
   avis restent visibles sur Google et dans le widget juste en dessous. */
const RESERVES = [
  'pas tres agreable', 'pas agreable', 'decu', 'dommage', 'malheureusement',
  'en revanche', 'par contre', 'bemol', 'manque de', 'trop cher', 'attente',
  'froid', 'moyen', 'decevant', 'probleme', 'sauf'
];

function sansAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/* Certains avis repetent la meme phrase (champ recopie plusieurs fois), avec ou
   sans ponctuation entre les deux copies : on cherche donc la reapparition du
   debut du texte, puis les phrases identiques quand la ponctuation existe. */
function seRepete(texte) {
  const plat = texte.toLowerCase().trim();
  const amorce = plat.slice(0, 40);
  if (amorce.length === 40 && plat.indexOf(amorce, 20) !== -1) return true;
  const parts = plat.split(/[.!?]+/).map((x) => x.trim()).filter((x) => x.length > 15);
  return new Set(parts).size !== parts.length;
}

const DEBUT = '<!-- AVIS-ZENCHEF:START -->';
const FIN = '<!-- AVIS-ZENCHEF:END -->';

function echappe(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalise(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

function dateLisible(iso) {
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

async function fetchPage(page) {
  const res = await fetch(`${HOST}/restaurants/${RESTAURANT_ID}/reviews?page=${page}`, {
    headers: {
      'Content-Type': 'application/json',
      'auth-token': TOKEN,
      restaurantId: RESTAURANT_ID
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur la page ${page}`);
  return res.json();
}

function selectionne(avis) {
  const vus = new Set();
  const retenus = [];
  for (const a of avis) {
    const corps = String(a.body || '').replace(/\s+/g, ' ').trim();
    if (!corps) continue;
    if (corps.length < LONGUEUR_MIN || corps.length > LONGUEUR_MAX) continue;
    if (Number(a.global) !== 5) continue;
    const sous = [a.service, a.menu, a.ambiance, a.value_for_money].map(Number);
    if (sous.some((n) => !n || n < 4)) continue;
    const plat = sansAccents(corps);
    if (RESERVES.some((mot) => plat.includes(mot))) continue;
    if (seRepete(corps)) continue;
    const cle = normalise(corps).slice(0, 60);
    if (vus.has(cle)) continue;
    vus.add(cle);
    retenus.push({
      id: a.id,
      note: Number(a.global),
      service: Number(a.service),
      menu: Number(a.menu),
      ambiance: Number(a.ambiance),
      rapport: Number(a.value_for_money),
      texte: corps,
      date: a.source_date || a.created_at
    });
    if (retenus.length >= NB_AFFICHES) break;
  }
  return retenus;
}

function rendu(avis, total) {
  const cartes = avis.map((a) => {
    const etoiles = '&#9733;'.repeat(a.note) + '<span class="text-gray-300">' + '&#9733;'.repeat(5 - a.note) + '</span>';
    return `          <figure class="rounded-2xl border border-gray-200 bg-gray-50 p-6 flex flex-col h-full">
            <div class="text-brand text-sm mb-3" role="img" aria-label="${a.note} sur 5">${etoiles}</div>
            <blockquote class="text-sm text-text leading-relaxed flex-1">${echappe(a.texte)}</blockquote>
            <figcaption class="text-xs text-text-light mt-4 pt-3 border-t border-gray-200">Avis v&eacute;rifi&eacute; &middot; ${dateLisible(a.date)}</figcaption>
          </figure>`;
  }).join('\n');

  const totalFr = String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${DEBUT}
        <!-- Genere par scripts/update-reviews.mjs — ne pas editer a la main. -->
        <div class="reveal mb-12">
          <p class="text-center text-sm text-text-light mb-6">D&eacute;pos&eacute;s par des clients apr&egrave;s leur repas, sur ${totalFr} avis re&ccedil;us</p>
          <div class="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
${cartes}
          </div>
        </div>
        ${FIN}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!TOKEN) {
    console.error('ZENCHEF_AUTH_TOKEN manquant. Usage : ZENCHEF_AUTH_TOKEN=xxx node scripts/update-reviews.mjs');
    process.exit(1);
  }

  const tous = [];
  let total = 0;
  for (let page = 1; page <= PAGES_A_SCANNER; page++) {
    const data = await fetchPage(page);
    total = data.total ?? total;
    tous.push(...(data.data || []));
    if (!data.next_page_url) break;
  }

  const retenus = selectionne(tous);
  console.log(`${tous.length} avis parcourus sur ${total} au total, ${retenus.length} retenus`);
  if (retenus.length < NB_AFFICHES) {
    console.warn(`Attention : seulement ${retenus.length} avis retenus sur ${NB_AFFICHES} attendus.`);
  }
  if (!retenus.length) {
    console.error('Aucun avis exploitable, index.html laisse intact.');
    process.exit(1);
  }

  const bloc = rendu(retenus, total);

  if (dryRun) {
    console.log('\n--- rendu (dry-run) ---\n');
    console.log(bloc);
    return;
  }

  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify({
    genere_le: new Date().toISOString(),
    total_avis: total,
    affiches: retenus
  }, null, 2) + '\n', 'utf8');

  const html = await fs.readFile(INDEX_PATH, 'utf8');
  const i = html.indexOf(DEBUT);
  const j = html.indexOf(FIN);
  if (i === -1 || j === -1) {
    console.error(`Reperes ${DEBUT} / ${FIN} absents de index.html.`);
    process.exit(1);
  }
  const sortie = html.slice(0, i) + bloc + html.slice(j + FIN.length);
  await fs.writeFile(INDEX_PATH, sortie, 'utf8');
  console.log(`index.html mis a jour (${retenus.length} avis) et snapshot ecrit dans data/avis-zenchef.json`);
}

main().catch((e) => {
  console.error('Echec :', e.message);
  process.exit(1);
});
