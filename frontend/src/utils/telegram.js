// Telegram Mini App Helper Utility
// Robust multi-source parser for Telegram User & WebApp SDK

export function getTelegramUser() {
  let user = null;

  // 1. Direct from official window.Telegram.WebApp.initDataUnsafe
  try {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser && tgUser.id && String(tgUser.id) !== '100000001') {
      user = tgUser;
    }
  } catch (e) {}

  // 2. Parse from window.Telegram.WebApp.initData (raw string)
  if (!user) {
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (initData) {
        const params = new URLSearchParams(initData);
        const userJson = params.get('user');
        if (userJson) {
          const parsed = JSON.parse(userJson);
          if (parsed && parsed.id && String(parsed.id) !== '100000001') {
            user = parsed;
          }
        }
      }
    } catch (e) {}
  }

  // 3. Parse directly from URL Hash (#tgWebAppData=...) or Search (?tgWebAppData=...)
  if (!user) {
    try {
      const fullUrl = window.location.href || '';
      if (fullUrl.includes('tgWebAppData=')) {
        const rawMatch = fullUrl.match(/tgWebAppData=([^&#]+)/);
        if (rawMatch && rawMatch[1]) {
          const decoded = decodeURIComponent(rawMatch[1]);
          const params = new URLSearchParams(decoded);
          const userJson = params.get('user');
          if (userJson) {
            const parsed = JSON.parse(userJson);
            if (parsed && parsed.id && String(parsed.id) !== '100000001') {
              user = parsed;
            }
          }
        }
      }
    } catch (e) {}
  }

  // 4. Check cached user in localStorage / sessionStorage
  if (!user) {
    try {
      const cached = localStorage.getItem('landy_tg_user') || sessionStorage.getItem('landy_tg_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && String(parsed.id) !== '100000001') {
          user = parsed;
        }
      }
    } catch (e) {}
  }

  // If real user was found, cache it for the session
  if (user && user.id && String(user.id) !== '100000001') {
    try {
      localStorage.setItem('landy_tg_user', JSON.stringify(user));
      sessionStorage.setItem('landy_tg_user', JSON.stringify(user));
    } catch (e) {}
  }

  // 5. Fallback if inside Telegram WebApp with mock/default
  if (!user && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    user = window.Telegram.WebApp.initDataUnsafe.user;
  }

  return user;
}

export function initTelegramApp() {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (typeof tg.ready === 'function') tg.ready();
      if (typeof tg.expand === 'function') tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#090a0f');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#090a0f');
      if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
    }
  } catch (e) {
    console.warn('Telegram WebApp init warning:', e);
  }
}
