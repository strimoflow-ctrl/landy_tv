// Official Telegram WebApp SDK (Local Bundle + Offline & Browser Mock Fallback)
(function () {
  var eventHandlers = {};
  var locationHash = '';
  try {
    locationHash = location.hash.toString();
  } catch (e) {}

  var initParams = {};
  if (locationHash.indexOf('#tgWebAppData=') >= 0) {
    var rawParams = locationHash.substr(locationHash.indexOf('#tgWebAppData=') + 14);
    var parts = rawParams.split('&');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].split('=');
      initParams[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    }
  }

  var isExpanded = false;
  var viewportHeight = window.innerHeight;

  var webApp = {
    initData: initParams.query_id ? rawParams : '',
    initDataUnsafe: (function () {
      if (initParams.user) {
        try {
          return {
            query_id: initParams.query_id,
            user: JSON.parse(initParams.user),
            auth_date: initParams.auth_date,
            hash: initParams.hash
          };
        } catch (e) {}
      }
      return {
        user: {
          id: 100000001,
          first_name: 'Landy User',
          username: 'landy_user'
        }
      };
    })(),
    version: '7.0',
    platform: (function () {
      if (/android/i.test(navigator.userAgent)) return 'android';
      if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
      return 'web';
    })(),
    colorScheme: 'dark',
    themeParams: {
      bg_color: '#0a0a0c',
      text_color: '#ffffff',
      hint_color: '#8b8b9e',
      link_color: '#ef4444',
      button_color: '#ef4444',
      button_text_color: '#ffffff',
      secondary_bg_color: '#151518'
    },
    isExpanded: true,
    viewportHeight: viewportHeight,
    viewportStableHeight: viewportHeight,
    headerColor: '#0a0a0c',
    backgroundColor: '#0a0a0c',
    isClosingConfirmationEnabled: false,
    BackButton: {
      isVisible: false,
      onClick: function (cb) { eventHandlers['backButtonClicked'] = cb; return this; },
      offClick: function () { delete eventHandlers['backButtonClicked']; return this; },
      show: function () { this.isVisible = true; return this; },
      hide: function () { this.isVisible = false; return this; }
    },
    MainButton: {
      text: 'CONTINUE',
      color: '#ef4444',
      textColor: '#ffffff',
      isVisible: false,
      isActive: true,
      isProgressVisible: false,
      setText: function (t) { this.text = t; return this; },
      onClick: function (cb) { eventHandlers['mainButtonClicked'] = cb; return this; },
      offClick: function () { delete eventHandlers['mainButtonClicked']; return this; },
      show: function () { this.isVisible = true; return this; },
      hide: function () { this.isVisible = false; return this; },
      enable: function () { this.isActive = true; return this; },
      disable: function () { this.isActive = false; return this; },
      showProgress: function () { this.isProgressVisible = true; return this; },
      hideProgress: function () { this.isProgressVisible = false; return this; }
    },
    HapticFeedback: {
      impactOccurred: function () { return this; },
      notificationOccurred: function () { return this; },
      selectionChanged: function () { return this; }
    },
    ready: function () {
      try {
        if (window.TelegramWebviewProxy) {
          window.TelegramWebviewProxy.postEvent('web_app_ready', '');
        }
      } catch (e) {}
    },
    expand: function () {
      this.isExpanded = true;
      try {
        if (window.TelegramWebviewProxy) {
          window.TelegramWebviewProxy.postEvent('web_app_expand', '');
        }
      } catch (e) {}
    },
    close: function () {
      try {
        if (window.TelegramWebviewProxy) {
          window.TelegramWebviewProxy.postEvent('web_app_close', '');
        }
      } catch (e) {}
    },
    openLink: function (url) {
      window.open(url, '_blank');
    },
    openTelegramLink: function (url) {
      window.open(url, '_blank');
    },
    showAlert: function (msg, cb) {
      alert(msg);
      if (cb) cb();
    },
    showConfirm: function (msg, cb) {
      var res = confirm(msg);
      if (cb) cb(res);
    },
    onEvent: function (eventType, eventHandler) {
      eventHandlers[eventType] = eventHandler;
    },
    offEvent: function (eventType, eventHandler) {
      delete eventHandlers[eventType];
    },
    sendData: function (data) {
      try {
        if (window.TelegramWebviewProxy) {
          window.TelegramWebviewProxy.postEvent('web_app_data_send', JSON.stringify({ data: data }));
        }
      } catch (e) {}
    }
  };

  // Attach to window
  window.Telegram = window.Telegram || {};
  window.Telegram.WebApp = webApp;
})();
