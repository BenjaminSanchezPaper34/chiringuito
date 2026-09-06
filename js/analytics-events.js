/* Chiringuito - evenements Vercel Web Analytics (sans cookie, exempte de consentement).
   Un seul ecouteur delegue : fonctionne sur toutes les pages et sur le contenu injecte.
   Evenements : tel, reservation (table|transat|autre), itineraire, newsletter, instagram,
   facebook, tiktok, billetterie, galerie, avis. */
(function () {
  var va = function () { (window.vaq = window.vaq || []).push(arguments); };
  window.va = window.va || va;
  function track(name, data) { try { window.va('event', { name: name, data: data || {} }); } catch (e) {} }
  window.chirTrack = track;

  function classify(a) {
    var href = a.getAttribute('href') || '';
    if (/^tel:/i.test(href)) return ['tel'];
    if (/bookings\.zenchef\.com/i.test(href)) {
      var type = /rid=360996/.test(href) ? 'transat' : (/rid=360974/.test(href) ? 'table' : 'autre');
      return ['reservation', { type: type }];
    }
    if (/maps\.google\.|maps\.apple\.|openstreetmap\.org\/\?/i.test(href)) return ['itineraire'];
    if (/instagram\.com/i.test(href)) return ['instagram', { cible: (href.split('instagram.com/')[1] || '').split(/[/?]/)[0] }];
    if (/facebook\.com/i.test(href)) return ['facebook'];
    if (/tiktok\.com/i.test(href)) return ['tiktok'];
    if (/shotgun\.live|ypl\.me|yurplan/i.test(href)) return ['billetterie'];
    if (/paper34\.fr\/galerie\//i.test(href)) return ['galerie', { album: href.split('/galerie/')[1] || '' }];
    if (/tripadvisor|search\.google\.com\/local\/reviews|g\.page/i.test(href)) return ['avis'];
    return null;
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var ev = classify(a);
    if (ev) track(ev[0], ev[1]);
  }, true);

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.id === 'newsletter-form') track('newsletter');
  }, true);
})();
