// === AUDITOR PORTAL — auditors.astranov.eu on globe ===
const AuditorPortal = {
  SITE_ID: 'auditors',
  SITE_URL: 'https://auditors.astranov.eu',

  syncGlobe() {
    const u = window._lastPos || { lat: 37.98, lng: 23.73 };
    GlobeEntity?.register?.({
      id: 'site-auditors',
      type: 'site',
      lat: u.lat + 0.08,
      lng: u.lng - 0.06,
      title: '◎ Astranov Auditors',
      subtitle: 'auditors.astranov.eu',
      description: 'Finance portal · invoices · payments · KPIs · tap to open',
      urgency: 1,
      radius: 0.016,
      data: { site_id: this.SITE_ID },
      _actionLabel: 'Open auditors',
      onTap: () => this.open({ tab: 'dashboard' }),
    });
  },

  open(opts) {
    const u = new URL(this.SITE_URL);
    if (opts?.tab) u.searchParams.set('tab', opts.tab);
    if (opts?.from) u.searchParams.set('from', opts.from);
    if (opts?.to) u.searchParams.set('to', opts.to);
    if (opts?.vendor_id) u.searchParams.set('vendor_id', opts.vendor_id);
    const meta = { domain: 'auditors.astranov.eu', site_id: this.SITE_ID, title: 'Astranov Auditors', url: u.toString() };
    if (window.AstranovSiteShell?.open) AstranovSiteShell.open(u.toString(), meta);
    else window.open(u.toString(), '_blank', 'noopener');
    AciCli?.print?.('◎ auditors.astranov.eu', 'ok');
    return u.toString();
  },

  async cli(parts) {
    const sub = (parts[1] || 'open').toLowerCase();
    if (sub === 'help' || sub === '?') {
      ACIControl?.reply('audit · auditors · audit open [from] [to]');
      AciCli?.print('auditors open | audit dashboard', 'ok');
      return;
    }
    if (sub === 'open' || sub === 'dashboard' || sub === 'site') {
      this.open({ tab: 'dashboard' });
      ACIControl?.reply('auditors.astranov.eu — invoices · payments · KPIs');
      return;
    }
    this.open();
  },
};
window.AuditorPortal = AuditorPortal;