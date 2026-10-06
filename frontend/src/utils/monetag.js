// Monetag Rewarded Interstitial Ad Integration
// Zone ID: 11964194
// Function: show_11964194()

let sdkLoadingPromise = null;

function loadMonetagSdk() {
  if (typeof window.show_11964194 === 'function') {
    return Promise.resolve();
  }
  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  sdkLoadingPromise = new Promise((resolve) => {
    // Check if script already in DOM
    const existing = document.querySelector('script[data-sdk="show_11964194"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://libtl.com/sdk.js';
      script.setAttribute('data-zone', '11964194');
      script.setAttribute('data-sdk', 'show_11964194');
      script.async = true;
      script.onload = () => {
        setTimeout(resolve, 300);
      };
      script.onerror = () => {
        console.warn('[Monetag] Failed to load sdk.js from libtl.com');
        resolve();
      };
      document.head.appendChild(script);
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof window.show_11964194 === 'function' || attempts > 20) {
          clearInterval(interval);
          resolve();
        }
      }, 150);
    }
  });

  return sdkLoadingPromise;
}

export async function showRewardedAd() {
  // Trigger Telegram Haptic Feedback if in Telegram WebApp
  try {
    if (window.Telegram?.WebApp?.HapticFeedback?.impactOccurred) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  } catch (e) {}

  // Ensure SDK is loaded
  await loadMonetagSdk();

  return new Promise((resolve) => {
    // 1. Verify Monetag function is available
    if (typeof window.show_11964194 === 'function') {
      try {
        console.log('[Monetag] Requesting Rewarded Interstitial Ad (show_11964194)...');
        window.show_11964194()
          .then(() => {
            console.log('🎉 [Monetag] User completed rewarded ad successfully!');
            try {
              if (window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
              }
            } catch (e) {}
            resolve({ success: true });
          })
          .catch((err) => {
            console.warn('[Monetag] Ad closed or failed to finish:', err);
            try {
              if (window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
              }
            } catch (e) {}
            resolve({ 
              success: false, 
              error: 'Ad closed before completion. Please watch the full ad to earn your watch time.' 
            });
          });
      } catch (err) {
        console.error('[Monetag Invocation Exception]:', err);
        resolve({ 
          success: false, 
          error: 'Could not display ad right now. Please try again in a few moments.' 
        });
      }
      return;
    }

    // 2. If Monetag is blocked by adblock or network
    console.error('[Monetag] show_11964194 is not available on window. Check adblock or network.');
    resolve({ 
      success: false, 
      error: '⚠️ Ad network unavailable. Please disable Ad-Blockers or VPN and retry.' 
    });
  });
}
