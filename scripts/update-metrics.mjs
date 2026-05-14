import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAuth } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'partenaires-dashboard', 'data', 'metrics.json');
const MANUAL_OVERRIDE_PATH = path.join(ROOT, 'partenaires-dashboard', 'data', 'manual-overrides.json');

const CHIRINGUITO_SITE = 'https://chiringuito-vias.fr/';
const INSTAGRAM_URL = 'https://www.instagram.com/chiringuitovias/';
const FACEBOOK_URL = 'https://www.facebook.com/chiringuitovias/';

const REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
  'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8'
};

function toIsoNow() {
  return new Date().toISOString();
}

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

function uniqueByKey(items, key) {
  const map = new Map();
  for (const item of items) {
    if (!item || item[key] == null) continue;
    map.set(item[key], item);
  }
  return [...map.values()];
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  try {
    const headers = options.useDefaultHeaders === false
      ? (options.headers || {})
      : {
          ...REQUEST_HEADERS,
          ...(options.headers || {})
        };

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}`);
  }
}

function htmlDecode(value) {
  if (!value) return value;
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x202f;', ' ')
    .replaceAll('&#8239;', ' ')
    .replaceAll('&#x2022;', '•')
    .replaceAll('&#x1f4e3;', '')
    .replaceAll('&#x1f379;', '')
    .replaceAll('&#x1f37d;', '')
    .replaceAll('&#x1f3d6;', '')
    .replaceAll('&#x1f4c6;', '')
    .replaceAll('&#x2600;&#xfe0f;', '');
}

function parseHumanNumber(rawValue) {
  if (rawValue == null) return null;
  let value = String(rawValue)
    .trim()
    .replace(/\u00A0|\u202F/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');

  const match = value.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/i);
  if (!match) {
    const fallback = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback) : null;
  }

  const base = Number(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  const multipliers = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
  return Math.round(base * (multipliers[suffix] || 1));
}

function parseFrenchCount(rawValue) {
  if (rawValue == null) return null;
  const normalized = String(rawValue)
    .replace(/\u00A0|\u202F/g, '')
    .replace(/[^0-9]/g, '');

  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractFirstCount(text) {
  if (!text) return null;
  const match = String(text).match(/(\d{1,3}(?:[ .\u00A0\u202F]\d{3})+|\d+)/);
  if (!match) return null;
  return parseFrenchCount(match[1]);
}

async function getWebsiteWidgetMetadata() {
  const siteHtml = await fetchText(CHIRINGUITO_SITE);

  const iframeMatch = siteHtml.match(/<iframe\s+[^>]*src=['"](https:\/\/[^'"\s]+\.elf\.site)['"]/i);
  if (!iframeMatch) {
    throw new Error('Impossible de localiser le widget Elfsight sur le site');
  }

  const iframeUrl = iframeMatch[1];
  const widgetIdMatch = iframeUrl.match(/https:\/\/([a-f0-9]{32})\.elf\.site/i);
  if (!widgetIdMatch) {
    throw new Error('Impossible d\'extraire le widget ID Elfsight');
  }

  const compactId = widgetIdMatch[1];
  const widgetId = compactId.replace(
    /([a-f0-9]{8})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{12})/,
    '$1-$2-$3-$4-$5'
  );

  return { iframeUrl, widgetId };
}

async function getElfsightSourceMetrics() {
  const { iframeUrl, widgetId } = await getWebsiteWidgetMetadata();

  const bootUrl = new URL('https://core.service.elfsight.com/p/boot/');
  bootUrl.searchParams.set('w', widgetId);
  bootUrl.searchParams.set('page', CHIRINGUITO_SITE);

  const boot = await fetchJson(bootUrl.toString());
  const widgetData = boot?.data?.widgets?.[widgetId]?.data;
  const token = widgetData?.public_widget_token;
  const sources = widgetData?.settings?.sources || [];

  if (!token) {
    throw new Error('Token Elfsight introuvable');
  }

  const origin = new URL(iframeUrl).origin;

  const sourceMetrics = [];
  for (const source of sources) {
    const sourceUrl = source?.url;
    if (!sourceUrl) continue;

    const dataUrl = new URL('https://service-reviews-ultimate.elfsight.com/data/sources');
    dataUrl.searchParams.set('uri', sourceUrl);

    try {
      const data = await fetchJson(dataUrl.toString(), {
        headers: {
          'x-widget-token': token,
          origin,
          referer: `${iframeUrl}/`,
          accept: 'application/json'
        },
        timeoutMs: 20000
      });

      const entry = data?.result?.data?.[0];
      if (!entry) continue;

      sourceMetrics.push({
        supplier: entry.supplier,
        uri: entry.uri,
        rating: entry.rating ?? null,
        reviews: entry.reviews_number ?? null,
        name: entry?.meta?.name || source.name || entry.supplier,
        source: 'Elfsight Reviews API'
      });
    } catch (error) {
      sourceMetrics.push({
        supplier: source.type,
        uri: source.url,
        rating: null,
        reviews: null,
        name: source.name || source.type,
        source: 'Elfsight Reviews API',
        error: error.message
      });
    }
  }

  return sourceMetrics;
}

async function getInstagramMetrics() {
  try {
    const apiUrl = 'https://i.instagram.com/api/v1/users/web_profile_info/?username=chiringuitovias';
    const payload = await fetchJson(apiUrl, {
      headers: {
        'x-ig-app-id': '936619743392459',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0',
        origin: 'https://www.instagram.com',
        referer: 'https://www.instagram.com/chiringuitovias/',
        accept: '*/*',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty'
      },
      useDefaultHeaders: false
    });

    const user = payload?.data?.user;
    if (!user) {
      throw new Error('Instagram API payload incomplet');
    }

    const followers = user?.edge_followed_by?.count ?? null;
    const edges = user?.edge_owner_to_timeline_media?.edges || [];
    const recentMedia = edges.slice(0, 12).map(e => ({
      thumbnail: e.node?.thumbnail_src || e.node?.display_url || null,
      permalink: e.node?.shortcode ? `https://www.instagram.com/p/${e.node.shortcode}/` : null,
      likes: e.node?.edge_liked_by?.count ?? 0,
      comments: e.node?.edge_media_to_comment?.count ?? 0
    })).filter(m => m.thumbnail);

    const totalEng = recentMedia.reduce((acc, m) => acc + m.likes + m.comments, 0);
    const engagementRate = recentMedia.length > 0 && followers > 0
      ? parseFloat((totalEng / recentMedia.length / followers * 100).toFixed(2))
      : null;

    return {
      followers,
      following: user?.edge_follow?.count ?? null,
      posts: user?.edge_owner_to_timeline_media?.count ?? null,
      recentMedia,
      engagementRate,
      source: 'Instagram public API'
    };
  } catch {
    const html = await fetchText(INSTAGRAM_URL, { useDefaultHeaders: false });
    const metaMatch = html.match(/(?:property|name)="(?:og:description|description)"\s+content="([^"]+)"/i);
    if (!metaMatch) throw new Error('Instagram API et fallback meta indisponibles');

    const description = htmlDecode(metaMatch[1]);
    const countsMatch = description.match(/([0-9.,KMB]+)\s*Followers,\s*([0-9.,KMB]+)\s*Following,\s*([0-9.,KMB]+)\s*Posts/i);
    if (!countsMatch) throw new Error('Compteurs Instagram introuvables');

    return {
      followers: parseHumanNumber(countsMatch[1]),
      following: parseHumanNumber(countsMatch[2]),
      posts: parseHumanNumber(countsMatch[3]),
      recentMedia: [],
      engagementRate: null,
      source: 'Instagram public meta'
    };
  }
}

async function getFacebookMetrics() {
  const html = await fetchText(FACEBOOK_URL, { useDefaultHeaders: false });

  const metaMatch = html.match(/property="og:description" content="([^"]+)"/i);
  if (!metaMatch) {
    throw new Error('Meta description Facebook introuvable');
  }

  const description = htmlDecode(metaMatch[1]);
  const split = description.split('·').map((part) => part.trim());

  const likesBySplit = extractFirstCount(split[0]);
  const talkingBySplit = extractFirstCount(split[1]);
  const checkinsBySplit = extractFirstCount(split[2]);

  const likesByRegex = extractFirstCount(description.match(/([0-9\u00A0\u202F .]+)\s*(?:J’aime|aime|likes?)/i)?.[1]);
  const talkingByRegex = extractFirstCount(description.match(/([0-9\u00A0\u202F .]+)\s*(?:en parlent|people talking)/i)?.[1]);
  const checkinsByRegex = extractFirstCount(description.match(/([0-9\u00A0\u202F .]+)\s*(?:personnes étaient ici|were here)/i)?.[1]);

  const likes = likesByRegex ?? likesBySplit;
  const talking = talkingByRegex ?? talkingBySplit;
  const checkins = checkinsByRegex ?? checkinsBySplit;

  return {
    likes,
    talkingAbout: talking,
    checkins,
    source: 'Facebook public meta'
  };
}

async function getGa4WebsiteMetrics() {
  const propertyId = process.env.GA4_PROPERTY_ID;

  const serviceAccountRaw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  const clientEmail = process.env.GA4_CLIENT_EMAIL;
  const privateKey = process.env.GA4_PRIVATE_KEY?.replaceAll('\\n', '\n');

  if (!propertyId || (!serviceAccountRaw && !(clientEmail && privateKey))) {
    return {
      status: 'not_configured',
      users30d: null,
      sessions30d: null,
      pageviews30d: null,
      dailyUsers: [],
      source: 'GA4 Data API'
    };
  }

  let credentials;
  if (serviceAccountRaw) {
    credentials = JSON.parse(serviceAccountRaw);
  } else {
    credentials = {
      client_email: clientEmail,
      private_key: privateKey
    };
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly']
  });

  const authClient = await auth.getClient();
  const accessTokenResponse = await authClient.getAccessToken();
  const accessToken = accessTokenResponse?.token;

  if (!accessToken) {
    throw new Error('Impossible d\'obtenir un token GA4');
  }

  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  const totalPayload = {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }]
  };

  const totalRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(totalPayload)
  });

  if (!totalRes.ok) {
    const errorText = await totalRes.text();
    throw new Error(`GA4 totals failed: ${totalRes.status} ${errorText}`);
  }

  const totalData = await totalRes.json();
  const totalRow = totalData.rows?.[0]?.metricValues || [];

  const users30d = Number(totalRow[0]?.value || 0);
  const sessions30d = Number(totalRow[1]?.value || 0);
  const pageviews30d = Number(totalRow[2]?.value || 0);

  const dailyPayload = {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }]
  };

  const dailyRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(dailyPayload)
  });

  if (!dailyRes.ok) {
    const errorText = await dailyRes.text();
    throw new Error(`GA4 daily failed: ${dailyRes.status} ${errorText}`);
  }

  const dailyData = await dailyRes.json();
  const dailyUsers = (dailyData.rows || []).map((row) => {
    const rawDate = row.dimensionValues?.[0]?.value;
    const value = Number(row.metricValues?.[0]?.value || 0);
    return {
      date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
      value
    };
  });

  return {
    status: 'live',
    users30d,
    sessions30d,
    pageviews30d,
    dailyUsers,
    source: 'GA4 Data API'
  };
}

async function loadJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function computeWeightedRating(items) {
  const valid = items.filter((item) => Number.isFinite(item.rating) && Number.isFinite(item.reviews) && item.reviews > 0);
  if (!valid.length) return null;

  const sumWeights = valid.reduce((acc, item) => acc + item.reviews, 0);
  const sum = valid.reduce((acc, item) => acc + item.rating * item.reviews, 0);
  return Number((sum / sumWeights).toFixed(2));
}

function sumNumbers(values) {
  return values.filter((value) => Number.isFinite(value)).reduce((acc, value) => acc + value, 0);
}

async function main() {
  const now = toIsoNow();

  const [existing, manualOverrides] = await Promise.all([
    loadJson(OUTPUT_PATH, null),
    loadJson(MANUAL_OVERRIDE_PATH, {})
  ]);

  const status = {};

  let instagram = null;
  try {
    instagram = await getInstagramMetrics();
    status.instagram = 'live';
  } catch (error) {
    status.instagram = 'error';
    instagram = { followers: null, following: null, posts: null, recentMedia: [], engagementRate: null, source: 'Instagram public API', error: error.message };
  }

  let facebook = null;
  try {
    facebook = await getFacebookMetrics();
    status.facebook = 'live';
  } catch (error) {
    status.facebook = 'error';
    facebook = { likes: null, talkingAbout: null, checkins: null, source: 'Facebook public meta', error: error.message };
  }

  let reviews = [];
  try {
    reviews = await getElfsightSourceMetrics();
    status.reviews = 'live';
  } catch (error) {
    status.reviews = 'error';
    reviews = [];
    status.reviewsError = error.message;
  }

  let website;
  try {
    website = await getGa4WebsiteMetrics();
    status.website = website.status;
  } catch (error) {
    status.website = 'error';
    website = {
      status: 'error',
      users30d: null,
      sessions30d: null,
      pageviews30d: null,
      dailyUsers: [],
      source: 'GA4 Data API',
      error: error.message
    };
  }

  const tripAdvisorReview = reviews.find((item) => item.supplier === 'trip-advisor') || null;
  const googleReview = reviews.find((item) => item.supplier === 'google') || null;
  const facebookReview = reviews.find((item) => item.supplier === 'facebook') || null;

  const totalAudience = sumNumbers([instagram.followers, facebook.likes]);
  const totalReviews = sumNumbers([
    tripAdvisorReview?.reviews,
    googleReview?.reviews,
    facebookReview?.reviews
  ]);

  const averageRating = computeWeightedRating(
    [tripAdvisorReview, googleReview, facebookReview].filter(Boolean)
  );

  const audienceMonth = monthKey();
  const audienceHistory = uniqueByKey(
    [
      ...((existing?.history?.audienceMonthly || []).filter(Boolean)),
      { month: audienceMonth, value: totalAudience || 0 }
    ],
    'month'
  ).sort((a, b) => a.month.localeCompare(b.month));

  const websiteDailyHistory = uniqueByKey(
    [
      ...((existing?.history?.websiteDailyUsers || []).filter(Boolean)),
      ...(website.dailyUsers || [])
    ],
    'date'
  ).sort((a, b) => a.date.localeCompare(b.date));

  const output = {
    generatedAt: now,
    sourceStatus: status,
    kpis: {
      totalAudience,
      totalReviews,
      averageRating,
      websiteUsers30d: website.users30d,
      websiteSessions30d: website.sessions30d,
      websitePageviews30d: website.pageviews30d
    },
    platforms: {
      instagram: {
        url: INSTAGRAM_URL,
        followers: instagram.followers,
        following: instagram.following,
        posts: instagram.posts,
        recentMedia: instagram.recentMedia || [],
        engagementRate: instagram.engagementRate ?? null,
        source: instagram.source,
        error: instagram.error || null
      },
      facebook: {
        url: FACEBOOK_URL,
        likes: facebook.likes,
        talkingAbout: facebook.talkingAbout,
        checkins: facebook.checkins,
        reviews: facebookReview?.reviews ?? null,
        reviewRating: facebookReview?.rating ?? null,
        source: facebook.source,
        error: facebook.error || null
      },
      tripadvisor: {
        url: tripAdvisorReview?.uri || null,
        rating: tripAdvisorReview?.rating ?? null,
        reviews: tripAdvisorReview?.reviews ?? null,
        source: tripAdvisorReview?.source || 'Elfsight Reviews API',
        error: tripAdvisorReview?.error || null
      },
      google: {
        url: googleReview?.uri || null,
        rating: googleReview?.rating ?? null,
        reviews: googleReview?.reviews ?? null,
        source: googleReview?.source || 'Elfsight Reviews API',
        error: googleReview?.error || null
      },
      website: {
        users30d: website.users30d,
        sessions30d: website.sessions30d,
        pageviews30d: website.pageviews30d,
        source: website.source,
        status: website.status,
        error: website.error || null
      }
    },
    history: {
      audienceMonthly: audienceHistory,
      websiteDailyUsers: websiteDailyHistory
    },
    notes: {
      websiteConnection:
        website.status === 'not_configured'
          ? 'Configurez GA4 (GA4_PROPERTY_ID + service account) pour activer les métriques de trafic site.'
          : null,
      generatedWith: 'scripts/update-metrics.mjs'
    }
  };

  const merged = {
    ...output,
    ...manualOverrides,
    kpis: {
      ...output.kpis,
      ...(manualOverrides.kpis || {})
    },
    platforms: {
      ...output.platforms,
      ...(manualOverrides.platforms || {})
    },
    history: {
      ...output.history,
      ...(manualOverrides.history || {})
    },
    notes: {
      ...output.notes,
      ...(manualOverrides.notes || {})
    }
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(merged, null, 2), 'utf8');

  const INLINE_PATH = path.join(ROOT, 'partenaires-dashboard', 'data', 'metrics-inline.js');
  await fs.writeFile(INLINE_PATH, `window.__metrics = ${JSON.stringify(merged)};\n`, 'utf8');

  console.log(`Metrics updated -> ${OUTPUT_PATH}`);
  console.log(`Inline JS      -> ${INLINE_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
