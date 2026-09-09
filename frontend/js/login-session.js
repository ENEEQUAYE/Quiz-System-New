/* Shared login session handling. Background requests never renew idle time. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const api = window.API_URL.replace(/\/$/, '');
  const publicPage = /\/(?:index|reset-password)\.html$/.test(location.pathname) || location.pathname.endsWith('/');
  let token = localStorage.getItem('token');
  let stopped = false;
  let checking = false;
  let pendingActivity = false;
  let lastActivitySent = -Infinity;
  let idleDeadline = Infinity;
  let absoluteDeadline = Infinity;
  let notice;
  let noticeText;
  let continueButton;

  window.loginReturnUrl = function(fallback) {
    const next = sessionStorage.getItem('loginReturnUrl');
    sessionStorage.removeItem('loginReturnUrl');
    return next && /^take-quiz\.html\?id=[a-f0-9]{24}$/i.test(next) ? next : fallback;
  };

  function showNotice(message, canContinue) {
    if (!document.body) return;
    if (!notice) {
      notice = document.createElement('div');
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.style.cssText = 'position:fixed;bottom:20px;left:5%;width:90%;z-index:10000;padding:16px;background:#fff3cd;color:#332701;border:1px solid #997404;border-radius:8px;box-shadow:0 2px 8px #0003';
      noticeText = document.createElement('span');
      continueButton = document.createElement('button');
      continueButton.type = 'button';
      continueButton.textContent = 'Stay signed in';
      continueButton.className = 'btn btn-primary ms-3';
      continueButton.addEventListener('click', () => updateSession(true));
      notice.append(noticeText, continueButton);
      document.body.append(notice);
    }
    noticeText.textContent = message;
    continueButton.hidden = !canContinue;
    notice.hidden = false;
  }

  function endSession(reason, clear = true) {
    if (stopped) return;
    stopped = true;
    window.dispatchEvent(new Event('login-session-ending'));
    if (location.pathname.endsWith('/take-quiz.html')) {
      const id = new URLSearchParams(location.search).get('id');
      if (/^[a-f0-9]{24}$/i.test(id || '')) sessionStorage.setItem('loginReturnUrl', 'take-quiz.html?id=' + id);
    }
    if (clear && localStorage.getItem('token') === token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    if (!publicPage) location.replace('index.html?session=' + reason);
  }

  // Handle only failures for the currently displayed authenticated session.
  window.fetch = async function(input, init) {
    const response = await nativeFetch(input, init);
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (token && response.status === 401 && url.href.startsWith(api + '/') &&
        headers.get('Authorization') === 'Bearer ' + token &&
        localStorage.getItem('token') === token) endSession('expired');
    return response;
  };

  async function updateSession(activity = false) {
    if (!token || stopped) return false;
    if (checking) { pendingActivity = pendingActivity || activity; return false; }
    checking = true;
    try {
      const response = await window.fetch(api + '/auth/session' + (activity ? '/activity' : ''), {
        method: activity ? 'POST' : 'GET',
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Session check failed');
      const state = await response.json();
      // Relative server deadlines avoid relying on the browser wall clock.
      const now = performance.now();
      idleDeadline = now + state.idleExpiresAt - state.serverNow;
      absoluteDeadline = now + state.expiresAt - state.serverNow;
      if (activity) lastActivitySent = now;
      renderWarning();
      return true;
    } catch (error) {
      if (!stopped) showNotice('Unable to verify your login session. Check your connection and retry.', true);
      return false;
    } finally {
      checking = false;
      if (pendingActivity) { pendingActivity = false; updateSession(true); }
    }
  }

  function renderWarning() {
    const remaining = Math.min(idleDeadline, absoluteDeadline) - performance.now();
    if (remaining <= 0) {
      updateSession(); // Another tab may have renewed the idle deadline.
    } else if (remaining <= 120000) {
      const absolute = absoluteDeadline <= idleDeadline;
      showNotice(absolute
        ? 'Your login session will end within two minutes. Save your work and sign in again.'
        : 'You will be signed out within two minutes due to inactivity.', !absolute);
    } else if (notice) notice.hidden = true;
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest?.('#logout-btn, [data-target="#logout"]');
    if (!button || !token) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const response = await nativeFetch(api + '/auth/logout', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
      });
      if (!response.ok && response.status !== 401) throw new Error('Logout failed');
      sessionStorage.removeItem('loginReturnUrl');
      endSession('logout');
    } catch (error) {
      showNotice('Logout could not be completed. Check your connection and try again.', false);
    }
  }, true);

  window.addEventListener('storage', event => {
    if (event.key === 'token' && event.newValue !== token) endSession('changed', false);
  });

  // Old tokens have no server session and must not trigger a login-page redirect.
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.sid) throw new Error('Legacy token');
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      token = null;
    }
  }
  window.loginSessionReady = token ? updateSession() : Promise.resolve(false);
  if (!token && !publicPage) endSession('expired');

  for (const name of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
    document.addEventListener(name, event => {
      if (!event.isTrusted || publicPage || document.hidden || stopped) return;
      if (performance.now() - lastActivitySent >= 60000) updateSession(true);
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateSession();
  });
  if (token) {
    setInterval(() => { if (!stopped) renderWarning(); }, 1000);
    setInterval(() => { if (!document.hidden) updateSession(); }, 30000);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (publicPage && new URLSearchParams(location.search).has('session')) {
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.className = 'alert alert-info';
      message.textContent = new URLSearchParams(location.search).get('session') === 'logout'
        ? 'You have been signed out.'
        : 'Please sign in again to continue. Your saved quiz progress is retained.';
      document.querySelector('form')?.prepend(message);
    }
  });
})();
