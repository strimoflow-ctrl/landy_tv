// Monetag Rewarded Interstitial Ad Integration
// Zone ID: 11964194

export function showRewardedAd() {
  return new Promise((resolve, reject) => {
    // 1. Check if Monetag Rewarded function is registered in window
    if (typeof window.show_11964194 === 'function') {
      try {
        window.show_11964194()
          .then(() => {
            // Successfully viewed ad
            resolve({ success: true });
          })
          .catch((err) => {
            console.warn('[Monetag Ad Error]:', err);
            resolve({ success: false, error: err?.message || 'Ad closed before completion' });
          });
      } catch (err) {
        console.error('[Monetag Invocation Error]:', err);
        resolve({ success: false, error: err.message });
      }
      return;
    }

    // 2. Dev / Localhost / Preview fallback
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDev) {
      console.log('[Dev Mode] Simulating Monetag Rewarded Ad (show_11964194)...');
      setTimeout(() => {
        resolve({ success: true, simulated: true });
      }, 1500);
      return;
    }

    // 3. If SDK script hasn't loaded yet
    console.warn('[Monetag] show_11964194 function not ready yet.');
    // Try to execute if dynamically available
    setTimeout(() => {
      if (typeof window.show_11964194 === 'function') {
        window.show_11964194().then(() => resolve({ success: true })).catch(reject);
      } else {
        resolve({ success: true, simulated: true });
      }
    }, 1200);
  });
}
