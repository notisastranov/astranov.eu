// === ONE DATABASE — lkoatrkhuigdolnjsbie for all Astranov tenants ===
const AstranovOneDatabase = {
  REF: 'lkoatrkhuigdolnjsbie',
  URL: 'https://lkoatrkhuigdolnjsbie.supabase.co',
  CUSTOM: 'https://api.astranov.eu',
  TENANTS: ['astranov.eu', 'coin.astranov.eu', 'auditors.astranov.eu', 'yachts.astranov.eu'],

  isCentral(url) {
    const u = String(url || SB_URL || '');
    return u.includes(this.REF) || u.includes('api.astranov.eu');
  },

  status() {
    return {
      one_database: true,
      ref: this.REF,
      url: SB_URL,
      central: this.isCentral(SB_URL),
      auth: typeof Auth?.user !== 'undefined' ? !!Auth.user : null,
      tenants: this.TENANTS,
      tables: 'profiles · booker_sites · avc_ledger · orders · balance_ledger',
    };
  },

  async cli(parts) {
    const sub = (parts[1] || 'status').toLowerCase();
    const s = this.status();
    if (sub === 'help' || sub === '?') {
      ACIControl?.reply('db status · one database · all tenants share lkoatrkhuigdolnjsbie');
      return;
    }
    AciCli?.print('── ONE DATABASE · ' + s.ref + ' ──', 'ok');
    AciCli?.print('URL: ' + s.url + (s.central ? ' ✓' : ' ✗ MISMATCH'), s.central ? 'ok' : 'err');
    AciCli?.print('Tenants: ' + s.tenants.join(' · '), 'dim');
    AciCli?.print(s.tables, 'dim');
    ACIControl?.reply(s.central ? 'One database active — all *.astranov.eu' : 'Database URL mismatch — fix config');
    return s;
  },
};
window.AstranovOneDatabase = AstranovOneDatabase;