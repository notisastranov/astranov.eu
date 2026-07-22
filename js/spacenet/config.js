/* SpaceNet public config — anon key is designed for client use */
(function (g) {
  'use strict';
  g.SN_CONFIG = {
    build: (document.querySelector('meta[name="astranov-build"]') || {}).content || '0',
    sbUrl: 'https://lkoatrkhuigdolnjsbie.supabase.co',
    sbKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI',
    live: 'https://astranov.eu',
  };
  g.SB_URL = g.SN_CONFIG.sbUrl;
  g.SB_KEY = g.SN_CONFIG.sbKey;
})(window);
