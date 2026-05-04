// Vercel serverless function — POST /api/newsletter
// Receives newsletter signup from chiringuito-vias.fr popup
// Forwards contact to the Zenchef "Inscription newsletter à partir du site" list (id 15867)
// If SMS opt-in is checked AND a phone is provided, also adds to the SMS list (id read from env, optional)

const ZENCHEF_API_BASE = 'https://api.zenchef.com/api/v2';
const RESTAURANT_ID = process.env.ZENCHEF_RESTAURANT_ID || '360974';
const TOKEN = process.env.ZENCHEF_TOKEN;
const NEWSLETTER_LIST_ID = process.env.ZENCHEF_NEWSLETTER_LIST_ID || '15867';
const SMS_LIST_ID = process.env.ZENCHEF_SMS_LIST_ID || ''; // optional, for SMS opt-ins

const ALLOWED_ORIGINS = [
  'https://chiringuito-vias.fr',
  'https://www.chiringuito-vias.fr',
  'http://localhost:3000', // dev
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function pushToList(listId, contact) {
  const res = await fetch(
    `${ZENCHEF_API_BASE}/restaurants/${RESTAURANT_ID}/audience-lists/${listId}/import`,
    {
      method: 'POST',
      headers: {
        'auth-token': TOKEN,
        'restaurantid': String(RESTAURANT_ID),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rows: [contact] }),
    }
  );
  return { status: res.status, ok: res.ok };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!TOKEN) {
    return res.status(500).json({ error: 'Server misconfigured: ZENCHEF_TOKEN missing' });
  }

  // Parse body (Vercel parses JSON automatically when content-type is set; also handle FormData)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Extract & validate
  const prenom = String(body.prenom || body.firstName || '').trim();
  const nom = String(body.nom || body.lastName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const smsOptin = body.sms_optin === 'oui' || body.sms_optin === true;
  const telephone = String(body.telephone || body.phone || '').replace(/\s+/g, '');

  // Honeypot — if filled, silently succeed (bot)
  if (body._gotcha) {
    return res.status(200).json({ ok: true });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!prenom || !nom) {
    return res.status(400).json({ error: 'First name and last name required' });
  }
  if (smsOptin && !/^[+]?[0-9]{8,}$/.test(telephone)) {
    return res.status(400).json({ error: 'Phone required for SMS opt-in' });
  }

  const contact = {
    civility: '',
    firstName: prenom,
    lastName: nom,
    email,
    phone: smsOptin ? telephone : '',
    language: 'fr',
  };

  try {
    // 1. Always add to the email newsletter list
    const emailResult = await pushToList(NEWSLETTER_LIST_ID, contact);

    // 2. If SMS opt-in and we have a separate SMS list configured, also add there
    let smsResult = null;
    if (smsOptin && SMS_LIST_ID) {
      smsResult = await pushToList(SMS_LIST_ID, contact);
    }

    if (!emailResult.ok) {
      return res.status(502).json({ error: 'Zenchef rejected the contact', detail: emailResult });
    }

    return res.status(200).json({
      ok: true,
      newsletter: emailResult.status,
      sms: smsResult ? smsResult.status : null,
    });
  } catch (err) {
    console.error('Zenchef API error:', err);
    return res.status(502).json({ error: 'Upstream API error' });
  }
}
