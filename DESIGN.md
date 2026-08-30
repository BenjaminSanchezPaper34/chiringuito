# DESIGN.md — Le Chiringuito · Vias-Plage

> Rétro-formalisation (30/08/2026) de la DA existante, validée de fait par le client au fil
> de la saison 2026. Ce document décrit ce qui EST — il sert de référence anti-dérive pour
> toutes les évolutions futures. Toute refonte visuelle passe par Benjamin.

**Secteur** : restaurant / plage privée / bar — saisonnier, festif, familial
**Personnalité en 3 mots** : solaire, festif, les-pieds-dans-le-sable
**Références** : DA historique du lieu (logo, bleu lagon) — pas de refonte, continuité de marque

---

## 1. Tokens couleurs

| Nom | Hex | Variable (Tailwind) | Rôle (argumenté) |
|-----|-----|---------------------|------------------|
| Bleu lagon | `#009BA4` | `brand` | L'unique décision chromatique permanente du système : CTA de réservation, liens, titres de section, fond du footer. C'est le bleu du logo — il relie le site à l'enseigne physique. |
| Lagon profond | `#007A82` | `brand-dark` | États hover du bleu lagon et cœur du dégradé footer. Jamais utilisé seul comme accent. |
| Lagon clair | `#00B8C4` | `brand-light` | Respirations ponctuelles (dégradés, icônes) — jamais porteur d'action. |
| Gris chaud | `#575756` | `text` | Texte courant — gris chaud plutôt que noir, hérité de la papeterie du lieu. |
| Gris sable | `#8A8A89` | `text-light` | Texte secondaire, sous-titres, microcopies. |
| Blanc / gris pâle | `#FFFFFF` / `gray-50` | — | Alternance des fonds de section (voir Interdits). |

**Exception maîtrisée — les cards soirées** : chaque événement a droit à son propre monde
chromatique (crème Opening, vert Coachella, bleu/rouge Porto Rico Reggaeton, orange Aperol,
violet nocturne Closing). C'est le seul endroit du site où la palette s'ouvre : l'ambiance
de la card (et de sa pill hero dérivée) EST l'identité visuelle de la soirée.

## 2. Typographie

- **Fonctionnelle** : Inter (300–700) — corps, nav, UI. Auto-hébergée (`/fonts/`, woff2
  latin + latin-ext) depuis le 30/08/2026 — licence OFL, ok commercial.
- **Display** : Parisienne (400) — droit d'apparaître UNIQUEMENT sur les titres de section
  et les grands moments émotionnels (hero, chiffres du dashboard). Jamais en corps de texte.
- Tailles : corps `text-base`, descriptions `text-sm`, `text-xs`/`text-[10px]` réservés aux
  microcopies sous CTA, badges et mentions. Grands titres responsives (`text-5xl → 7xl`).
- **Jamais de CDN de polices tiers (CNIL)** — appliqué.

## 3. Matière

- **Rayons** : `rounded-3xl` (cards), `rounded-full` (boutons pill, badges)
- **Ombres** : neutres, discrètes au repos (`shadow-sm`) montant au survol (`shadow-2xl`) ;
  glows teintés réservés aux pills hero événementielles (couleur de l'événement)
- **Espacements** : sections `py-20 md:py-28`, grilles `gap-5/6`
- **Grain** : classe `noise` sur certaines sections claires (menu, soirées, FAQ)

## 4. Animation

- **Moteur unique** : GSAP + ScrollTrigger (auto-hébergés) + Lenis smooth scroll. Un seul
  moteur par élément — pas de Motion (site statique, pas de React).
- **Tempo** : reveals 0.6–0.9 s, fade + translateY(30-50 px), staggers 0.1–0.15 s
- **Au scroll** : `.reveal` sur les blocs, split-text du hero, compteurs Instagram
- **Ne bouge jamais** : le texte courant, les cartes/menus, les pages légales
- **Effet signature** : la pill hero événementielle — dégradé aux couleurs de la soirée en
  cours + glow pulsé (`hero-cta-glow`), déposée puis retirée au fil du calendrier. Le hero
  vit au rythme des soirées.
- `prefers-reduced-motion` respecté (animations coupées) ; vidéos bas de page en
  chargement différé (IntersectionObserver + repli scroll).

## 5. Interdits de ce projet

- Le bleu lagon ne sert jamais de fond de section courante (réservé au footer et aux CTA)
- Pas deux sections adjacentes au même fond (alternance blanc / gris-50 / sombre)
- Les mondes chromatiques des soirées restent DANS leurs cards (+ pill hero dérivée) —
  ils ne contaminent jamais le reste du site
- Pas de glassmorphism hors badges des cards événements (backdrop-blur léger toléré là)
- Aucune animation sur les contenus utilitaires (cartes, prix, FAQ, légal)
- Esthétique template gratuit, presets d'origine, deux moteurs sur un même élément

---
*Rétro-formalisé le 30/08/2026 — à valider par Benjamin (aucun impact visuel : constat de l'existant).*
