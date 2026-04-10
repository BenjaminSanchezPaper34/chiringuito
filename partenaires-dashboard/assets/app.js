/* ── Formatters ── */
const fmt   = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const fmt1d = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

function safeVal(v, suffix = '') {
  if (v == null || Number.isNaN(v)) return '--';
  return fmt.format(v) + suffix;
}
function safeRating(v) {
  if (v == null || Number.isNaN(v)) return '--';
  return fmt1d.format(v) + ' / 5';
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/* ── Star builder ── */
function renderStars(containerId, rating) {
  const el = document.getElementById(containerId);
  if (!el || rating == null) return;
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.25 && rating - full < 0.75 ? 1 : 0;
  const empty = 5 - full - half;
  el.innerHTML =
    '⭐'.repeat(full) +
    (half ? '✨' : '') +
    '<span style="opacity:.25">☆</span>'.repeat(empty);
}

/* ── Status label ── */
function statusLabel(s) {
  if (s === 'live') return 'live';
  if (s === 'not_configured') return 'à connecter';
  return 'erreur';
}

/* ═══════════════════════════════════════════
   RENDER FUNCTIONS
═══════════════════════════════════════════ */

function renderHeroHighlights(data) {
  const pv   = data?.physicalVisitors;
  const kpis = data?.kpis || {};

  const social  = kpis.totalAudience  ?? 0;
  const season  = pv?.seasonTotal     ?? 0;
  const events  = pv?.eventsTotal     ?? 0;
  const totalRv = kpis.totalReviews   ?? 0;
  const reach   = social + season + events;

  setText('hlReach',   safeVal(reach || null));
  setText('hlRating',  safeRating(kpis.averageRating));
  setText('hlReviews', safeVal(totalRv || null));
}

function renderMegaKpis(data) {
  const pv   = data?.physicalVisitors;
  const kpis = data?.kpis || {};

  setText('mkpiSeasonVisitors', safeVal(pv?.seasonTotal));
  setText('mkpiSocial',        safeVal(kpis.totalAudience));
  setText('mkpiReviews',       safeVal(kpis.totalReviews));
  // mkpiPeak is hardcoded in HTML
}

/* ── Physical visitors ── */
function renderPhysicalSection(data) {
  const pv = data?.physicalVisitors;
  if (!pv) return;

  // Monthly cards
  const container = document.getElementById('monthlyCards');
  if (container && pv.monthlyData) {
    const maxTotal = Math.max(...pv.monthlyData.map(m => m.total));
    container.innerHTML = pv.monthlyData.map(m => {
      const isPeak = m.dailyAvg >= 1000;
      const pct = maxTotal > 0 ? Math.round(m.total / maxTotal * 100) : 0;
      return `
        <div class="month-card ${isPeak ? 'month-card--peak' : ''}">
          <div>
            <div class="month-name">${m.month}</div>
            <div class="month-daily">${fmt.format(m.dailyAvg)} / jour</div>
          </div>
          <div class="month-total">
            ${fmt.format(m.total)}
            <span>visiteurs</span>
          </div>
          <div class="month-progress" style="width:${pct}%"></div>
        </div>`;
    }).join('');
  }

  // Footfall chart
  renderFootfallChart(pv);
}

function renderFootfallChart(pv) {
  const ctx = document.getElementById('footfallChart');
  if (!ctx || !window.Chart || !pv?.monthlyData) return;

  const labels = pv.monthlyData.map(m => m.month);
  const values = pv.monthlyData.map(m => m.total);

  new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Visiteurs',
        data: values,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(0,155,164,.75)';
          const isPeak = (pv.monthlyData[context.dataIndex]?.dailyAvg ?? 0) >= 1000;
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          if (isPeak) {
            grad.addColorStop(0, 'rgba(251,146,60,.96)');
            grad.addColorStop(1, 'rgba(234,88,12,.78)');
          } else {
            grad.addColorStop(0, 'rgba(0,194,203,.96)');
            grad.addColorStop(1, 'rgba(0,125,135,.72)');
          }
          return grad;
        },
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: 'easeOutCubic',
        delay: (context) => context.dataIndex * 110
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmt.format(ctx.parsed.y) + ' visiteurs'
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: '600' } }
        },
        y: {
          grid: { color: 'rgba(0,0,0,.05)' },
          ticks: { callback: v => fmt.format(v) }
        }
      }
    }
  });
}

/* ── Social platforms ── */
function renderSocial(data) {
  const ig = data?.platforms?.instagram || {};
  const fb = data?.platforms?.facebook  || {};

  setText('igFollowers', safeVal(ig.followers));
  setText('igPosts',     safeVal(ig.posts));
  setText('igFollowing', safeVal(ig.following));

  const erWrap = document.getElementById('igEngagementWrap');
  if (erWrap && ig.engagementRate != null) {
    setText('igEngagement', fmt1d.format(ig.engagementRate) + '\u00a0%');
    erWrap.style.display = '';
  }

  setText('fbLikes',   safeVal(fb.likes));
  setText('fbReviews', safeVal(fb.reviews));
  setText('fbRating',  safeRating(fb.reviewRating));
}

/* ── E-Réputation / Reviews ── */
function renderReputation(data) {
  const google = data?.platforms?.google     || {};
  const ta     = data?.platforms?.tripadvisor || {};
  const fb     = data?.platforms?.facebook   || {};

  // Google
  setText('googleRating',  safeRating(google.rating));
  setText('googleReviews', safeVal(google.reviews, ' avis'));
  renderStars('googleStars', google.rating);

  // TripAdvisor
  setText('taRating',  safeRating(ta.rating));
  setText('taReviews', safeVal(ta.reviews, ' avis'));
  renderStars('taStars', ta.rating);

  // Facebook Avis
  setText('fbRevRating', safeRating(fb.reviewRating));
  setText('fbRevCount',  safeVal(fb.reviews, ' avis'));
  renderStars('fbStars', fb.reviewRating);

  // Reputation badges
  const kpis = data?.kpis || {};
  setText('totalReviewsBadge', `${safeVal(kpis.totalReviews)} avis au total`);
  setText('avgRatingBadge',    `${safeRating(kpis.averageRating)} moyenne pondérée`);
}

/* ── Website ── */
function renderWebsite(data) {
  const web  = data?.platforms?.website || {};
  const kpis = data?.kpis || {};

  const analyticsCard = document.getElementById('websiteAnalyticsCard');

  if (web.status === 'not_configured') {
    // Hide analytics card + section title — no data to show
    if (analyticsCard) analyticsCard.style.display = 'none';
    // Hide the "Site web" section header too
    const webSection = document.querySelector('[aria-label="Site web"]');
    if (webSection) {
      const header = webSection.querySelector('.section-header');
      if (header) header.style.display = 'none';
    }
    // Reach card goes full-width
    const reachCard = document.querySelector('.platform-card--reach');
    if (reachCard) reachCard.style.gridColumn = '1 / -1';
    return;
  }

  setText('webSessions',  safeVal(web.sessions30d ?? kpis.websiteSessions30d));
  setText('webUsers',     safeVal(web.users30d    ?? kpis.websiteUsers30d));
  setText('webPageviews', safeVal(web.pageviews30d ?? kpis.websitePageviews30d));
}

/* ── Total Reach card ── */
function renderReachCard(data) {
  const pv   = data?.physicalVisitors;
  const kpis = data?.kpis || {};

  const social  = kpis.totalAudience ?? 0;
  const season  = pv?.seasonTotal    ?? 0;
  const events  = pv?.eventsTotal    ?? 0;
  const reach   = social + season + events;

  setText('totalReach', safeVal(reach || null));

  const bd = document.getElementById('reachBreakdown');
  if (!bd) return;

  const items = [
    { label: '🌊 Visiteurs physiques / saison', value: season },
    { label: '🎉 Soirées événementielles (×3)',  value: events },
    { label: '📱 Abonnés réseaux sociaux',       value: social },
  ];
  if (kpis.websiteUsers30d) {
    items.push({ label: '🌐 Visiteurs site (30j)', value: kpis.websiteUsers30d });
  }

  bd.innerHTML = items.map(item => `
    <div class="reach-item">
      <span class="reach-item-label">${item.label}</span>
      <span class="reach-item-value">${safeVal(item.value)}</span>
    </div>
  `).join('');
}

/* ── Charts ── */
function renderAudienceChart(data) {
  const ctx = document.getElementById('audienceChart');
  if (!ctx || !window.Chart) return;

  const series = data?.history?.audienceMonthly || [];

  // Need at least 2 points for a meaningful line chart
  if (series.length < 2) {
    const card = ctx.closest('.chart-card');
    if (card) card.style.display = 'none';
    return;
  }

  const labels = series.map(p => p.month);
  const values = series.map(p => p.value || 0);

  new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Audience sociale totale',
        data: values,
        borderColor: '#009ba4',
        backgroundColor: 'rgba(0,155,164,.15)',
        tension: 0.38,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#009ba4'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,.04)' } },
        y: {
          grid: { color: 'rgba(0,0,0,.04)' },
          ticks: { callback: v => fmt.format(v) }
        }
      }
    }
  });
}

function renderProofChart(data) {
  const ctx = document.getElementById('proofChart');
  if (!ctx || !window.Chart) return;

  const p = data?.platforms || {};
  const google = p.google?.reviews       || 0;
  const ta     = p.tripadvisor?.reviews  || 0;
  const fb     = p.facebook?.reviews     || 0;

  new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Google', 'Facebook Avis', 'TripAdvisor'],
      datasets: [{
        data: [google, fb, ta],
        backgroundColor: ['#4285f4', '#1877f2', '#34e0a1'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt.format(ctx.parsed)} avis (${Math.round(ctx.parsed / (google + fb + ta) * 100)}%)`
          }
        }
      }
    }
  });
}

/* ── Status list ── */
function renderStatusList(statusMap) {
  const list = document.getElementById('statusList');
  if (!list) return;

  list.innerHTML = '';
  const labels = {
    instagram: 'Instagram',
    facebook:  'Facebook',
    reviews:   'Avis (TripAdvisor / Google)',
    website:   'Site Web (GA4)'
  };

  for (const [key, value] of Object.entries(statusMap || {})) {
    if (key.endsWith('Error')) continue;
    const li    = document.createElement('li');
    const name  = document.createElement('span');
    name.textContent = labels[key] || key;
    const badge = document.createElement('span');
    badge.className  = `badge ${value || 'error'}`;
    badge.textContent = statusLabel(value);
    li.append(name, badge);
    list.appendChild(li);
  }
}

/* ── Photo marquee ── */
function renderPhotoMarquee(data) {
  const section = document.getElementById('photoMarqueeSection');
  const track   = document.getElementById('photoTrack');
  const photos  = data?.platforms?.instagram?.recentMedia || [];
  if (!section || !track || photos.length < 3) return;

  const html = [...photos, ...photos].map(p => `
    <a class="photo-item" href="${p.permalink || 'https://www.instagram.com/chiringuitovias/'}" target="_blank" rel="noopener">
      <img src="${p.thumbnail}" alt="Photo Instagram Chiringuito Vias" loading="lazy" onerror="this.closest('.photo-item').style.opacity='0'">
    </a>`).join('');
  track.innerHTML = html;
  section.style.display = '';
}

/* ── Season calendar ── */
function renderSeasonCalendar(data) {
  const container = document.getElementById('seasonCalendar');
  if (!container) return;

  const pv = data?.physicalVisitors;
  const monthlyData = pv?.monthlyData || [];
  const openNames = monthlyData.map(m => m.month);
  const peakNames = monthlyData.filter(m => m.dailyAvg >= 1000).map(m => m.month);

  const months = [
    ['Jan','Janvier'],['Fév','Février'],['Mar','Mars'],['Avr','Avril'],
    ['Mai','Mai'],['Juin','Juin'],['Juil','Juillet'],['Août','Août'],
    ['Sep','Septembre'],['Oct','Octobre'],['Nov','Novembre'],['Déc','Décembre']
  ];

  container.innerHTML = months.map(([abbr, full]) => {
    const isPeak = peakNames.includes(full);
    const isOpen = openNames.includes(full);
    const type = isPeak ? 'peak' : isOpen ? 'open' : 'closed';
    const icon = isPeak ? '🏖️' : isOpen ? '☀️' : '·';
    return `<div class="season-month">
      <div class="season-dot season-dot--${type}">${icon}</div>
      <span class="season-month-label season-month-label--${type}">${abbr}</span>
    </div>`;
  }).join('');
}

/* ── GA4 website chart ── */
function renderWebsiteChart(data) {
  const web    = data?.platforms?.website || {};
  const wrapEl = document.getElementById('webChartWrap');
  const noteEl = document.getElementById('websiteChartNote');
  const daily  = data?.history?.websiteDailyUsers || [];

  // Hide entire chart card when GA4 not configured
  if (web.status === 'not_configured') {
    const card = document.querySelector('.chart-card--full');
    if (card) card.style.display = 'none';
    return;
  }

  if (noteEl) noteEl.textContent = '';
  if (wrapEl) wrapEl.style.display = daily.length ? '' : 'none';

  const ctx = document.getElementById('websiteChart');
  if (!ctx || !window.Chart || !daily.length) return;

  new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: daily.map(d => d.date),
      datasets: [{
        label: 'Utilisateurs / jour',
        data: daily.map(d => d.value || 0),
        borderColor: '#009ba4',
        backgroundColor: 'rgba(0,155,164,.1)',
        tension: 0.35,
        fill: true,
        pointRadius: 2,
        pointBackgroundColor: '#009ba4'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 11 } } },
        y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: v => fmt.format(v) } }
      }
    }
  });
}

/* ═══════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════ */
function render(data) {
  renderHeroHighlights(data);
  renderMegaKpis(data);
  renderPhysicalSection(data);
  renderSocial(data);
  renderReputation(data);
  renderWebsite(data);
  renderReachCard(data);
  renderAudienceChart(data);
  renderProofChart(data);
  renderStatusList(data?.sourceStatus);
  renderPhotoMarquee(data);
  renderSeasonCalendar(data);
  renderWebsiteChart(data);

  // Header meta
  const ts = data?.generatedAt ? fmtDt.format(new Date(data.generatedAt)) : '--';
  setText('generatedAt', `Mise à jour: ${ts}`);

  const statuses  = data?.sourceStatus || {};
  // not_configured = optional feature, not an error
  const allLive   = Object.entries(statuses)
    .filter(([k, v]) => !k.endsWith('Error') && typeof v === 'string' && v !== 'not_configured')
    .every(([, v]) => v === 'live');
  setText('globalStatus', allLive ? 'Toutes les sources actives' : 'Vérification requise');
}

/* ── Load error ── */
function renderLoadError(details) {
  setText('globalStatus', 'Sources indisponibles');
  const trust = document.querySelector('.trust');
  if (!trust) return;
  const old = document.getElementById('loadErrorBox');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'loadErrorBox';
  Object.assign(box.style, {
    marginTop: '12px', padding: '12px', borderRadius: '10px',
    background: 'rgba(198,50,50,.07)', border: '1px solid rgba(198,50,50,.22)',
    fontSize: '.86rem', lineHeight: '1.45'
  });
  box.innerHTML = `<strong>Erreur de chargement</strong><br>
    Le fichier <code>metrics.json</code> est introuvable depuis cette URL.<br>
    <span style="opacity:.8">${details}</span>`;
  trust.appendChild(box);
}

/* ── Fetch with fallback ── */
async function fetchMetrics() {
  // Données embarquées (metrics-inline.js) — fonctionne en file:// et en HTTP
  if (window.__metrics) return window.__metrics;

  const bodyUrl = document.body?.dataset?.metricsUrl;
  const candidates = [
    bodyUrl,
    new URL('./data/metrics.json', window.location.href).toString(),
    `${window.location.origin}/dashboard/data/metrics.json`,
    `${window.location.origin}/partenaires-dashboard/data/metrics.json`,
    `${window.location.origin}/data/metrics.json`
  ].filter(Boolean);

  const tried = [];
  for (const url of [...new Set(candidates)]) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      tried.push(`${url} → HTTP ${res.status}`);
      if (!res.ok) continue;
      return await res.json();
    } catch (err) {
      tried.push(`${url} → ${err.message}`);
    }
  }
  throw new Error(tried.join(' | '));
}

/* ═══════════════════════════════════════════
   COUNTER ANIMATION
═══════════════════════════════════════════ */
function animateCounter(el, target, duration = 1400) {
  if (!target || Number.isNaN(target)) return;
  const start = performance.now();
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value = Math.round(easeOut(progress) * target);
    el.textContent = fmt.format(value);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function setupCounterObserver(data) {
  const kpis = data?.kpis || {};
  const pv   = data?.physicalVisitors || {};

  const totalReach = (kpis.totalAudience ?? 0) + (pv.seasonTotal ?? 0) + (pv.eventsTotal ?? 0);
  const counters = [
    { id: 'mkpiSeasonVisitors', value: pv.seasonTotal },
    { id: 'mkpiSocial',        value: kpis.totalAudience },
    { id: 'mkpiReviews',       value: kpis.totalReviews },
    { id: 'mkpiPeak',          value: 1000 },
    { id: 'igFollowers',       value: data?.platforms?.instagram?.followers },
    { id: 'fbLikes',           value: data?.platforms?.facebook?.likes },
    { id: 'totalReach',        value: totalReach },
    { id: 'hlReach',           value: totalReach },
    { id: 'hlReviews',         value: kpis.totalReviews },
    { id: 'evOpening',         value: pv.events?.[0]?.visitors ?? 2500 },
    { id: 'evCoachella',       value: pv.events?.[1]?.visitors ?? 2500 },
    { id: 'evClosing',         value: pv.events?.[2]?.visitors ?? 2500 },
  ];

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const raw = el.dataset.counterTarget;
      if (raw) animateCounter(el, Number(raw));
      observer.unobserve(el);
    });
  }, { threshold: 0.2 });

  for (const { id, value } of counters) {
    if (value == null || Number.isNaN(value)) continue;
    const el = document.getElementById(id);
    if (!el) continue;
    el.dataset.counterTarget = String(Math.round(value));
    el.textContent = '0'; // reset so animation always plays from zero
    observer.observe(el);
  }
}

/* ── Scroll reveal observer ── */
function setupRevealObserver() {
  const targets = document.querySelectorAll(
    '.pitch-section, .mega-kpis, .section-block, .charts-grid, .trust, .contact-footer'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.07, rootMargin: '0px 0px -30px 0px' });

  targets.forEach(el => {
    el.classList.add('animate-reveal');
    observer.observe(el);
  });
}

/* ── Boot ── */
async function boot() {
  try {
    const data = await fetchMetrics();
    render(data);
    setupCounterObserver(data);
    setupRevealObserver();
  } catch (err) {
    renderLoadError(err.message);
    console.error('Dashboard load failed', err);
  }
}

boot();
