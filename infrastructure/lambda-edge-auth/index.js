'use strict';

const VALID_PIN = '092890';
const AUTH_COOKIE = 'gym_auth_v1';
const AUTH_TOKEN = 'gym_authenticated_v1_brock_secure_2024';

const PIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gym Workout Engine</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0a;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 20px;
  }
  .container {
    width: 100%;
    max-width: 340px;
    text-align: center;
    padding: 40px 24px;
    background: #1c1c1e;
    border-radius: 24px;
    border: 1px solid #38383a;
  }
  .logo {
    font-size: 52px;
    margin-bottom: 16px;
    display: block;
  }
  h1 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 6px;
  }
  .subtitle {
    color: #8e8e93;
    font-size: 14px;
    margin-bottom: 32px;
  }
  .error-msg {
    color: #ff375f;
    font-size: 13px;
    margin-bottom: 16px;
    min-height: 18px;
    font-weight: 500;
  }
  .pin-display {
    display: flex;
    justify-content: center;
    gap: 14px;
    margin-bottom: 32px;
  }
  .pin-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #38383a;
    transition: background 0.15s ease, transform 0.1s ease;
  }
  .pin-dot.filled {
    background: #ff375f;
    transform: scale(1.15);
  }
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    max-width: 280px;
    margin: 0 auto;
  }
  .key {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #2c2c2e;
    border: none;
    color: #ffffff;
    font-size: 22px;
    font-weight: 400;
    cursor: pointer;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s ease;
    -webkit-tap-highlight-color: transparent;
    letter-spacing: -0.5px;
  }
  .key:hover { background: #3a3a3c; }
  .key:active { background: #48484a; transform: scale(0.95); }
  .key.empty { background: transparent; cursor: default; pointer-events: none; }
  .key.delete { background: transparent; font-size: 20px; }
  .key.delete:hover { background: #2c2c2e; }
</style>
</head>
<body>
<div class="container">
  <span class="logo">🏋️</span>
  <h1>Gym Workout Engine</h1>
  <p class="subtitle">Enter your PIN to continue</p>
  <p class="error-msg" id="err">{{ERROR_MSG}}</p>
  <div class="pin-display" id="pinDisplay">
    <div class="pin-dot" id="d0"></div>
    <div class="pin-dot" id="d1"></div>
    <div class="pin-dot" id="d2"></div>
    <div class="pin-dot" id="d3"></div>
    <div class="pin-dot" id="d4"></div>
    <div class="pin-dot" id="d5"></div>
  </div>
  <div class="keypad">
    <button class="key" onclick="add('1')">1</button>
    <button class="key" onclick="add('2')">2</button>
    <button class="key" onclick="add('3')">3</button>
    <button class="key" onclick="add('4')">4</button>
    <button class="key" onclick="add('5')">5</button>
    <button class="key" onclick="add('6')">6</button>
    <button class="key" onclick="add('7')">7</button>
    <button class="key" onclick="add('8')">8</button>
    <button class="key" onclick="add('9')">9</button>
    <button class="key empty" aria-hidden="true"></button>
    <button class="key" onclick="add('0')">0</button>
    <button class="key delete" onclick="del()" aria-label="Delete">⌫</button>
  </div>
</div>
<script>
  let p = '';
  function upd() {
    for (let i = 0; i < 6; i++) {
      const d = document.getElementById('d'+i);
      d.className = 'pin-dot' + (i < p.length ? ' filled' : '');
    }
  }
  function add(d) {
    if (p.length >= 6) return;
    p += d;
    upd();
    if (p.length === 6) {
      setTimeout(() => { window.location.href = '/__auth?pin=' + p; }, 150);
    }
  }
  function del() {
    p = p.slice(0, -1);
    upd();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') add(e.key);
    else if (e.key === 'Backspace') del();
  });
</script>
</body>
</html>`;

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const qs = request.querystring || '';

  // Parse cookies
  const rawCookies = (request.headers['cookie'] || []).map(h => h.value).join('; ');
  const cookies = {};
  rawCookies.split(';').forEach(c => {
    const idx = c.indexOf('=');
    if (idx > 0) {
      const k = c.slice(0, idx).trim();
      const v = c.slice(idx + 1).trim();
      cookies[k] = v;
    }
  });

  // Authenticated — pass through
  if (cookies[AUTH_COOKIE] === AUTH_TOKEN) {
    return request;
  }

  // PIN submission
  if (uri === '/__auth') {
    const params = new URLSearchParams(qs);
    const pin = params.get('pin') || '';
    if (pin === VALID_PIN) {
      const maxAge = 30 * 24 * 60 * 60; // 30 days
      return {
        status: '302',
        statusDescription: 'Found',
        headers: {
          location: [{ key: 'Location', value: '/' }],
          'set-cookie': [{
            key: 'Set-Cookie',
            value: `${AUTH_COOKIE}=${AUTH_TOKEN}; Path=/; HttpOnly; Secure; Max-Age=${maxAge}; SameSite=Strict`,
          }],
          'cache-control': [{ key: 'Cache-Control', value: 'no-store' }],
        },
        body: '',
      };
    }
    // Wrong PIN
    return {
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{ key: 'Location', value: '/?pin_error=1' }],
        'cache-control': [{ key: 'Cache-Control', value: 'no-store' }],
      },
      body: '',
    };
  }

  // Show PIN page
  const hasError = qs.includes('pin_error=1') || uri.includes('pin_error=1');
  const html = PIN_PAGE_HTML.replace('{{ERROR_MSG}}', hasError ? 'Incorrect PIN. Please try again.' : '');

  return {
    status: '200',
    statusDescription: 'OK',
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }],
      'cache-control': [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
    },
    body: html,
  };
};
