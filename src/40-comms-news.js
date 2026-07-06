// ── COMMS: phone + EU PMR (real audio, no simulation) ──
const Comms = {
  vhfActive: false,
  pmr: { channel: 11, freqMHz: 446.13125, label: 'EU PMR 11' },

  async startPhone() {
    await SuperCli?.run('phone');
  },

  startVHF() {
    if (this.vhfActive && PmrRadio?.open) {
      GlobeDeck?.showStage('sat-radio', 'radio');
      return;
    }
    this.vhfActive = true;
    PmrRadio.show();
  },

  startTelecomms() {
    this.startVHF();
  }
};

// ── NEWS (real RSS) ──
const NewsFeed = {
  items: [],
  async fetch() {
    try {
      const url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://feeds.bbci.co.uk/news/world/rss.xml');
      const r = await fetch(url);
      const xml = await r.text();
      const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([^\]<]+)/g)].map(m => m[1]).filter(t => t.length > 12 && !t.includes('BBC'));
      this.items = titles.slice(0, 8);
    } catch { this.items = ['Astranov Collective Intelligence online', 'Globe trackball active', 'ACI ready for orders and comms']; }
    this.tick();
  },
  tick() {
    if (!this.items.length) return;
    const i = Math.floor(Date.now() / 12000) % this.items.length;
    const line = (AstroGlyphs?.news || '📰') + ' ' + this.items[i];
    if (GlobeDeck && !GlobeDeck.thinking && !GlobeDeck._userEngaged) {
      GlobeDeck.setPreview(line);
    }
  },
  flash() {
    this.fetch();
    const worldLat = 51.5, worldLng = -0.12;
    MapDepict.action('news', { worldLat, worldLng, detail: (this.items[0] || '').slice(0, 50) });
    SuperCli?.flyForTask?.('news', { worldLat, worldLng });
    if (Voice.maySpeak()) speak((this.items[0] || 'News').slice(0, 100), () => resumeListening());
  }
};
window.Comms = Comms;
window.NewsFeed = NewsFeed;