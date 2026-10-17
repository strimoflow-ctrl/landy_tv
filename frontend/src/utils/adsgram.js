// Adsgram Rewarded Video Ad Integration
// Block ID (UnitID): 54333
// Official Adsgram SDK: https://sad.adsgram.ai/js/sad.min.js

const ADSGRAM_BLOCK_ID = '54333';

let adsgramInitPromise = null;
let adControllerInstance = null;

/**
 * Ensures the Adsgram script is loaded and ready
 */
export function loadAdsgramSdk() {
  if (typeof window.Adsgram !== 'undefined') {
    return Promise.resolve();
  }
  if (adsgramInitPromise) {
    return adsgramInitPromise;
  }

  adsgramInitPromise = new Promise((resolve) => {
    // Check if script is already in the document
    let script = document.querySelector('script[src*="adsgram"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://sad.adsgram.ai/js/sad.min.js';
      script.async = true;
      script.onload = () => {
        setTimeout(resolve, 200);
      };
      script.onerror = (err) => {
        console.warn('[Adsgram] Failed to load official SDK script:', err);
        resolve();
      };
      document.head.appendChild(script);
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof window.Adsgram !== 'undefined' || attempts > 25) {
          clearInterval(interval);
          resolve();
        }
      }, 150);
    }
  });

  return adsgramInitPromise;
}

/**
 * Get or initialize the Adsgram AdController
 */
function getAdController() {
  if (adControllerInstance) {
    return adControllerInstance;
  }
  if (typeof window.Adsgram !== 'undefined' && typeof window.Adsgram.init === 'function') {
    try {
      adControllerInstance = window.Adsgram.init({
        blockId: ADSGRAM_BLOCK_ID,
        debug: false
      });
      return adControllerInstance;
    } catch (e) {
      console.error('[Adsgram] Controller init error:', e);
      return null;
    }
  }
  return null;
}

/**
 * Show Rewarded Video Ad using Adsgram
 * Returns Promise<{ success: boolean, error?: string }>
 */
export async function showRewardedAd() {
  // Trigger Telegram Haptic Feedback on button tap
  try {
    if (window.Telegram?.WebApp?.HapticFeedback?.impactOccurred) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  } catch (e) {}

  // 1. Ensure SDK script is present
  await loadAdsgramSdk();

  const controller = getAdController();

  if (!controller) {
    console.warn('[Adsgram] SDK unavailable. Check network or adblocker.');
    return {
      success: false,
      error: '⚠️ Sponsor stream is currently unavailable. Please check your connection or retry.'
    };
  }

  return new Promise((resolve) => {
    console.log('[Adsgram] Invoking Rewarded Video Ad with Block ID:', ADSGRAM_BLOCK_ID);

    controller.show()
      .then((result) => {
        console.log('🎉 [Adsgram] Ad completed successfully:', result);

        // Haptic feedback on reward earned
        try {
          if (window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
        } catch (e) {}

        resolve({ success: true, result });
      })
      .catch((result) => {
        console.warn('[Adsgram] Ad skipped, closed early, or failed:', result);

        try {
          if (window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
          }
        } catch (e) {}

        // Format user-friendly professional explanation
        let msg = 'Sponsor ad was closed before completion. Please watch the full 15s spotlight to unlock your stream pass.';
        if (result && result.description) {
          if (result.description.toLowerCase().includes('no ad') || result.description.toLowerCase().includes('fill')) {
            msg = 'No sponsor video available right now. Please try again in a few moments.';
          } else if (result.description.toLowerCase().includes('skip')) {
            msg = 'Please complete the entire sponsor spotlight to claim your watch time.';
          }
        }

        resolve({
          success: false,
          error: msg,
          raw: result
        });
      });
  });
}
