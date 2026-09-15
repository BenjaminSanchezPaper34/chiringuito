/* Sonde de performance temporaire — chargee uniquement avec ?perf=1
 * Mesure la duree reelle de chaque frame et l'attribue a la section
 * qui occupe le centre du viewport, puis affiche le classement.
 * A retirer une fois le diagnostic fait. */
(function () {
  'use strict';

  function demarrer() {
    var sections = [].slice.call(document.querySelectorAll('section[id], header[id]'));
    var bornes = [];
    function mesurerBornes() {
      bornes = sections.map(function (s) {
        var r = s.getBoundingClientRect();
        return { id: s.id, haut: r.top + window.scrollY, bas: r.bottom + window.scrollY };
      });
    }
    mesurerBornes();
    window.addEventListener('resize', mesurerBornes, { passive: true });
    // les carrousels construisent leurs copies en cours de route : on remesure
    setTimeout(mesurerBornes, 4000);

    var stats = Object.create(null);
    function pour(id) {
      if (!stats[id]) stats[id] = { frames: 0, total: 0, pire: 0, lentes: 0 };
      return stats[id];
    }

    var boite = document.createElement('div');
    boite.setAttribute('aria-hidden', 'true');
    boite.style.cssText = [
      'position:fixed', 'left:8px', 'bottom:8px', 'z-index:2147483647',
      'background:rgba(8,16,20,.92)', 'color:#fff', 'padding:10px 12px',
      'border-radius:10px', 'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
      'white-space:pre', 'pointer-events:none', 'max-width:92vw',
      'box-shadow:0 8px 24px -8px rgba(0,0,0,.6)'
    ].join(';');
    boite.textContent = 'SONDE PERF — prete\nfais defiler toute la page doucement';
    document.body.appendChild(boite);

    var precedent = performance.now();
    var dernierRendu = 0;

    function sectionCourante() {
      var centre = window.scrollY + window.innerHeight / 2;
      for (var i = 0; i < bornes.length; i++) {
        if (centre >= bornes[i].haut && centre < bornes[i].bas) return bornes[i].id;
      }
      return '(hors section)';
    }

    function afficher() {
      var lignes = Object.keys(stats).map(function (id) {
        var s = stats[id];
        return {
          id: id,
          fps: Math.round(s.frames / (s.total / 1000)),
          pire: Math.round(s.pire),
          lentes: s.lentes,
          frames: s.frames
        };
      }).filter(function (l) { return l.frames > 20; })
        .sort(function (a, b) { return b.lentes - a.lentes || b.pire - a.pire; });

      boite.textContent = 'SONDE PERF — fait defiler toute la page\n'
        + 'section'.padEnd(14) + 'fps  pire  saccades\n'
        + lignes.slice(0, 8).map(function (l) {
            return l.id.slice(0, 13).padEnd(14) + String(l.fps).padStart(3)
                 + String(l.pire + 'ms').padStart(7) + String(l.lentes).padStart(9);
          }).join('\n');
    }

    function boucle(maintenant) {
      var delta = maintenant - precedent;
      precedent = maintenant;
      // on ignore les pauses longues (onglet cache, changement d'app)
      if (delta < 1000) {
        var s = pour(sectionCourante());
        s.frames++;
        s.total += delta;
        if (delta > s.pire) s.pire = delta;
        if (delta > 33) s.lentes++; // en dessous de 30 images/seconde
      }
      if (maintenant - dernierRendu > 400) { dernierRendu = maintenant; afficher(); }
      requestAnimationFrame(boucle);
    }
    requestAnimationFrame(boucle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
