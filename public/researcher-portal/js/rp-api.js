/**
 * Deliberately separate from /js/api.js's HBJ object — different storage
 * keys, different token, never cross-referenced. This isn't paranoia for
 * its own sake: it mirrors exactly what the backend enforces (a
 * researcher-portal token is REJECTED on every internal route and vice
 * versa), so the frontend shouldn't blur that line either.
 */
const RP = (() => {
  const TOKEN_KEY = 'rp_access_token';
  const RESEARCHER_KEY = 'rp_researcher';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function getResearcher() { try { return JSON.parse(localStorage.getItem(RESEARCHER_KEY) || 'null'); } catch { return null; } }
  function setResearcher(r) { localStorage.setItem(RESEARCHER_KEY, JSON.stringify(r)); }
  function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(RESEARCHER_KEY); }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      clearSession();
      if (!location.pathname.endsWith('/login.html')) location.href = '/researcher-portal/login.html';
      throw new Error('Unauthorized');
    }
    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
      const message = (body && body.message) || res.statusText || 'Request failed';
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    return body;
  }

  function requireAuth() {
    if (!getToken()) { location.href = '/researcher-portal/login.html'; return false; }
    return true;
  }

  function logout() { clearSession(); location.href = '/researcher-portal/login.html'; }

  return { api, getToken, setToken, getResearcher, setResearcher, clearSession, requireAuth, logout };
})();
