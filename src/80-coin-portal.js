// === COIN PORTAL — coin.astranov.eu money platform for all users ===
const CoinPortal = {
  SITE_ID: 'coin',
  SITE_URL: 'https://coin.astranov.eu',

  syncGlobe() {
    const u = window._lastPos || { lat: 37.98, lng: 23.73 }
    GlobeEntity?.register?.({
      id: 'site-coin',
      type: 'site',
      lat: u.lat - 0.04,
      lng: u.lng + 0.1,
      title: '◎ AVC Wallet',
      subtitle: 'coin.astranov.eu',
      description: 'Money for all Astranov users — 1 AVC = 1 EUR · work-mint · transparent ledger.',
      urgency: 3,
      radius: 0.018,
      data: { coin: 'AVC', peg: 1 },
      _actionLabel: 'Open AVC wallet',
      onTap: () => this.open(),
    })
  },

  open(tab) {
    const u = new URL(this.SITE_URL)
    if (tab) u.searchParams.set('tab', tab)
    if (Auth?.session?.access_token) {
      u.searchParams.set('shell', '1')
    }
    window.open(u.toString(), '_blank', 'noopener')
    GlobeDeck?.expand?.('AVC · coin.astranov.eu')
    AciCli?.print?.('◎ coin.astranov.eu — wallet for all users', 'ok')
    ACIControl?.reply('AVC wallet · 1:1 EUR · work-mint only')
  },

  async cli(parts) {
    const sub = (parts[1] || 'open').toLowerCase()
    if (sub === 'help' || sub === '?') {
      ACIControl?.reply('coin open · coin wallet · coin transparency')
      AciCli?.print('coin — coin.astranov.eu · AVC money platform for all users', 'ok')
      return
    }
    if (sub === 'wallet' || sub === 'balance') return AvcJustice?.showBalance?.()
    if (sub === 'ledger' || sub === 'transparency') return this.open('transparency')
    if (sub === 'earn' || sub === 'justice') return this.open(sub === 'earn' ? 'earn' : 'justice')
    return this.open(parts[2] || null)
  },
}
window.CoinPortal = CoinPortal