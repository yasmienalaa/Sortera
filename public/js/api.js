/**
 * Talks to the NestJS API built in Phases 1-4. No framework, no build step —
 * plain fetch. Tokens live in localStorage (accessToken, deviceToken); a
 * real production build would consider httpOnly cookies instead, but that
 * needs the API and this static frontend served from the exact same
 * origin/cookie policy, which is already true here (same NestJS app).
 */
const HBJ = (() => {
  const ACCESS_TOKEN_KEY = 'hbj_access_token';
  const DEVICE_TOKEN_KEY = 'hbj_device_token';
  const USER_KEY = 'hbj_user';

  function getAccessToken() { return localStorage.getItem(ACCESS_TOKEN_KEY); }
  function setAccessToken(t) { localStorage.setItem(ACCESS_TOKEN_KEY, t); }
  function getDeviceToken() { return localStorage.getItem(DEVICE_TOKEN_KEY); }
  function setDeviceToken(t) { if (t) localStorage.setItem(DEVICE_TOKEN_KEY, t); }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } }
  function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function clearSession() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // deviceToken is deliberately kept — "remember this device" should
    // survive a normal logout, only a real "forget this device" action
    // (not built yet) should clear it.
  }

  function getCurrentSessionId() {
    const token = getAccessToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.sid || null;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} path e.g. "/dashboard"
   * @param {RequestInit} [options]
   */
  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(path, { ...options, headers });

    if (res.status === 401) {
      clearSession();
      if (!location.pathname.endsWith('/login.html')) {
        location.href = '/login.html';
      }
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
    if (!getAccessToken()) {
      location.href = '/login.html';
      return false;
    }
    return true;
  }

  function logout() {
    clearSession();
    location.href = '/login.html';
  }

  return {
    api,
    getAccessToken, setAccessToken,
    getDeviceToken, setDeviceToken,
    getUser, setUser,
    getCurrentSessionId,
    clearSession, requireAuth, logout,
  };
})();
