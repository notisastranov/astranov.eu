// === AVC JUSTICE COIN — transparent work-based currency (1 AVC = 1 EUR peg) ===
const AvcJustice = {
  COIN: 'AVC',
  PEG_EUR: 1,
  MOTTO: 'Justice → Truth → Freedom',
  _constitution: null,

  async api(mode, payload = {}) {
    const headers = await (Auth?.authHeaders?.() ?? Promise.resolve({
      'Content-Type': 'application/json',
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
    }))
    const r = await fetch(SB_URL + '/functions/v1/avc-ledger', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode, ...payload }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'avc-ledger ' + r.status)
    return j
  },

  async loadConstitution() {
    try {
      this._constitution = await this.api('constitution')
      if (this._constitution?.peg_eur) this.PEG_EUR = this._constitution.peg_eur
    } catch (_) {
      this._constitution = { peg_eur: 1, transparent: true, mint_rule: 'work-mint only' }
    }
    return this._constitution
  },

  formatAvc(amount) {
    const n = Number(amount || 0)
    return n.toFixed(2) + ' AVC (= ' + (n * this.PEG_EUR).toFixed(2) + ' EUR)'
  },

  eurToAvc(eur) {
    return Math.round(Number(eur || 0) * this.PEG_EUR * 100) / 100
  },

  syncGlobe() {
    const u = window._lastPos || { lat: 37.98, lng: 23.73 }
    GlobeEntity?.register?.({
      id: 'site-avc-ledger',
      type: 'site',
      lat: u.lat - 0.06,
      lng: u.lng + 0.08,
      title: '◎ AVC Justice Ledger',
      subtitle: '1 AVC = 1 EUR · work-mint only',
      description: 'Transparent Astranov coin — human work, delivery, vendors, drivers. Tap for ledger.',
      urgency: 2,
      radius: 0.017,
      data: { coin: 'AVC' },
      _actionLabel: 'Open AVC ledger',
      onTap: () => this.openLedger(),
    });
  },

  openLedger() {
    GlobeDeck?.expand?.('AVC Justice Ledger');
    this.cli(['avc', 'ledger']);
  },

  async showBalance() {
    if (!Auth?.user) {
      ACIControl?.reply('Sign in for AVC balance — 1 AVC = 1 EUR work credit');
      return null;
    }
    const r = await this.api('balance')
    AciCli?.print('◎ ' + this.formatAvc(r.avc), 'ok')
    ACIControl?.reply('Balance ' + r.avc.toFixed(2) + ' AVC (= ' + r.eur_equivalent + ' EUR) · work-minted only')
    return r
  },

  async showLedger(limit) {
    const r = await this.api('ledger', { limit: limit || 25, all: !!Auth?.user })
    if (!r.entries?.length) {
      AciCli?.print('AVC ledger empty — earn from delivery, vendor, driver, specialist work', 'dim')
      return r
    }
    AciCli?.print('── AVC transparent ledger (1:1 EUR) · ' + (r.total_entries || 0) + ' entries ──', 'dim')
    r.entries.forEach(e => {
      const sign = e.delta_avc >= 0 ? '+' : ''
      AciCli?.print('#' + e.seq + ' ' + sign + Number(e.delta_avc).toFixed(2) + ' AVC · ' + e.work_type
        + (e.public_note ? ' · ' + e.public_note.slice(0, 60) : ''), e.delta_avc >= 0 ? 'ok' : 'dim')
    })
    ACIControl?.reply('AVC ledger · ' + r.entries.length + ' shown · peg ' + r.peg_eur + ' EUR')
    return r
  },

  async verifyChain() {
    const r = await this.api('verify_chain')
    const msg = r.chain_valid ? 'AVC chain valid · ' + r.checked + ' links' : 'AVC chain break detected'
    AciCli?.print(msg, r.chain_valid ? 'ok' : 'err')
    ACIControl?.reply(msg)
    return r
  },

  async cli(parts) {
    const sub = (parts[1] || 'help').toLowerCase()
    await this.loadConstitution()

    if (sub === 'help' || sub === '?') {
      ACIControl?.reply('avc balance · avc ledger · avc justice · avc verify · coin')
      AciCli?.print('avc | coin — 1 AVC = 1 EUR · work-mint only · no fiat keyboard money', 'ok')
      return
    }
    if (sub === 'balance' || sub === 'wallet') return this.showBalance()
    if (sub === 'ledger' || sub === 'transparency' || sub === 'chain') return this.showLedger(40)
    if (sub === 'verify') return this.verifyChain()
    if (sub === 'justice' || sub === 'constitution' || sub === 'peg') {
      const c = this._constitution || {}
      AciCli?.print('AVC · ' + (c.motto || this.MOTTO), 'ok')
      AciCli?.print('Peg: 1 AVC = ' + (c.peg_eur ?? 1) + ' EUR', 'ok')
      AciCli?.print(c.mint_rule || 'Work-mint only inside Astranov', 'dim')
      ACIControl?.reply('AVC justice coin · 1:1 EUR · transparent work ledger')
      return
    }
    return this.showBalance()
  },
}
window.AvcJustice = AvcJustice