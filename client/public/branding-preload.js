(function() {
  try {
    var cached = localStorage.getItem('polly-branding-colors');
    if (cached) {
      var colors = JSON.parse(cached);
      var style = document.documentElement.style;
      if (colors.primary) {
        style.setProperty('--polly-orange', colors.primary);
        style.setProperty('--primary', colors.primaryHSL);
      }
      if (colors.secondary) {
        style.setProperty('--polly-blue', colors.secondary);
      }
      if (colors.schedule) {
        style.setProperty('--color-schedule', colors.schedule);
        style.setProperty('--color-schedule-light', colors.scheduleLight);
      }
      if (colors.survey) {
        style.setProperty('--color-survey', colors.survey);
        style.setProperty('--color-survey-light', colors.surveyLight);
      }
      if (colors.organization) {
        style.setProperty('--color-organization', colors.organization);
        style.setProperty('--color-organization-light', colors.organizationLight);
      }
    }
  } catch (e) {}

  // PWA meta preload — sync iOS/standalone tags from cached settings before React mounts.
  try {
    var pwa = localStorage.getItem('polly-pwa-meta');
    if (pwa) {
      var meta = JSON.parse(pwa);
      function setMeta(name, content) {
        if (!content) return;
        var el = document.querySelector('meta[name="' + name + '"]');
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('name', name);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      }
      if (meta.siteName) {
        setMeta('apple-mobile-web-app-title', meta.siteName);
        setMeta('application-name', meta.siteName);
      }
      if (meta.themeColor) {
        setMeta('theme-color', meta.themeColor);
      }
      if (meta.lang) {
        document.documentElement.setAttribute('lang', meta.lang);
      }
      if (meta.dir) {
        document.documentElement.setAttribute('dir', meta.dir);
      }
    }
  } catch (e) {}
})();
