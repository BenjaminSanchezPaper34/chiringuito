// Paper34 — intègre css/tailwind.css dans la page d'accueil (fin de la requête bloquante au rendu,
// gain Lighthouse mobile). Les sous-pages gardent le <link>. À relancer après chaque compilation :
//   npm run build:css
import { readFileSync, writeFileSync } from 'node:fs';

const page = 'index.html';
let html = readFileSync(page, 'utf8');
const LINK = '<link rel="stylesheet" href="/css/tailwind.css"/>';

// --reset : remet le <link> avant compilation, sinon Tailwind scanne le CSS intégré et le gonfle
if (process.argv.includes('--reset')) {
  writeFileSync(page, html.replace(/<!-- TAILWIND-INLINE:START[\s\S]*?<!-- TAILWIND-INLINE:END -->/, () => LINK));
  process.exit(0);
}
const css = readFileSync('css/tailwind.css', 'utf8').trim();
const bloc = `<!-- TAILWIND-INLINE:START (genere par scripts/inline-css.mjs, ne pas editer) -->\n  <style>${css}</style>\n  <!-- TAILWIND-INLINE:END -->`;

if (html.includes('<!-- TAILWIND-INLINE:START')) {
  html = html.replace(/<!-- TAILWIND-INLINE:START[\s\S]*?<!-- TAILWIND-INLINE:END -->/, () => bloc);
} else if (html.includes(LINK)) {
  html = html.replace(LINK, () => bloc);
} else {
  throw new Error('ni marqueurs TAILWIND-INLINE ni <link> tailwind.css dans index.html');
}
writeFileSync(page, html);
console.log(`✓ ${page} : ${css.length} octets de CSS intégrés`);
