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
})();
