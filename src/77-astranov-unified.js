// === ASTRANOV UNIFIED — delivery · globe · search · social · AVC justice ===
const AstranovUnified = {
  MOTTO: 'One globe · one ledger · real human work',
  PILLARS: [
    {
      id: 'delivery',
      icon: '📦',
      label: 'Goods delivery',
      hint: 'order · vendors · drivers · AVC checkout',
      run: () => Commerce?.initUI?.() || ACIControl?.reply('Say: order <item> from <vendor>'),
    },
    {
      id: 'globe',
      icon: '🌍',
      label: 'Earth exploration',
      hint: 'city · drop-in · yacht · auditors pin',
      run: () => {
        const u = window._lastPos || { lat: 37.98, lng: 23.73 }
        CityLife?.dropIn?.(u.lat, u.lng, { label: 'unified explore' })
        GlobeDeck?.expand?.('Earth · explore')
      },
    },
    {
      id: 'search',
      icon: '🔍',
      label: 'Internet search',
      hint: 'cli search · youtube · find video',
      run: () => CliHub?.open?.() || SuperCli?.run('cli search'),
    },
    {
      id: 'social',
      icon: '💬',
      label: 'Social & comms',
      hint: 'cli · cloud dm · profile · news',
      run: () => CliHub?.open?.() || MapComms?.open?.(),
    },
    {
      id: 'avc',
      icon: '◎',
      label: 'AVC Justice Coin',
      hint: '1 AVC = 1 EUR · work-mint · transparent ledger',
      run: () => AvcJustice?.openLedger?.(),
    },
  ],

  syncGlobe() {
    const u = window._lastPos || { lat: 37.98, lng: 23.73 }
    GlobeEntity?.register?.({
      id: 'site-astranov-unified',
      type: 'site',
      lat: u.lat + 0.05,
      lng: u.lng - 0.07,
      title: '⬡ Astranov Unified',
      subtitle: 'Delivery · Globe · Search · Social · AVC',
      description: 'All platforms in one — work-based justice coin, no fiat keyboard money.',
      urgency: 3,
      radius: 0.02,
      data: { pillars: this.PILLARS.length },
      _actionLabel: 'Open unified hub',
      onTap: () => this.openHub(),
    })
  },

  openHub() {
    GlobeDeck?.expand?.('Astranov Unified')
    this.cli(['unified', 'status'])
  },

  statusText() {
    const peg = AvcJustice?.PEG_EUR ?? 1
    return this.PILLARS.map(p => p.icon + ' ' + p.label + ' — ' + p.hint).join('\n')
      + '\n◎ AVC peg 1:' + peg + ' EUR · minted from verified work only'
  },

  async cli(parts) {
    const sub = (parts[1] || 'help').toLowerCase()
    await AvcJustice?.loadConstitution?.()

    if (sub === 'help' || sub === '?' || sub === 'pillars') {
      AciCli?.print('── Astranov Unified · exceeds separate platforms ──', 'ok')
      this.PILLARS.forEach(p => AciCli?.print(p.icon + ' ' + p.label + ' · ' + p.hint, 'dim'))
      AciCli?.print('◎ AVC 1:1 EUR · justice from human work · transparent chain', 'ok')
      ACIControl?.reply('unified status · unified delivery · unified search · unified avc')
      return
    }

    if (sub === 'status' || sub === 'manifest' || sub === 'all') {
      AciCli?.print(this.statusText(), 'ok')
      ACIControl?.reply('Five pillars active — delivery, globe, search, social, AVC justice')
      return
    }

    const pillar = this.PILLARS.find(p => p.id === sub || p.id.startsWith(sub))
    if (pillar) {
      pillar.run()
      ACIControl?.reply(pillar.label + ' · ' + pillar.hint)
      return
    }

    if (sub === 'avc' || sub === 'coin' || sub === 'justice') {
      return AvcJustice?.cli?.(['avc', parts[2] || 'justice'])
    }
    if (sub === 'search') return CliHub?.runSearch?.(parts.slice(2).join(' '))
    if (sub === 'order') return SuperCli?.run?.(parts.slice(1).join(' '))
    if (sub === 'globe' || sub === 'earth' || sub === 'explore') {
      this.PILLARS.find(p => p.id === 'globe')?.run()
      return
    }

    return this.openHub()
  },
}
window.AstranovUnified = AstranovUnified