// === BRAIN CONVERSATION — adult neurons for real dialogue (scenario-trained) ===
const BrainConversation = {
  MATURITY: 0,
  CYCLE_LEARNS: 0,
  MAX_LOCAL: 64,

  maturityTier() {
    const m = this.MATURITY;
    if (m >= 5) return 'sage';
    if (m >= 2) return 'adult';
    if (m >= 0.5) return 'teen';
    return 'child';
  },

  ADULT_NEURONS: [
    { id: 'justice', strength: 1.5, text: 'Speak with justice first — AVC work-mint, transparent ledger, no fiat keyboard money. 1 AVC = 1 EUR.' },
    { id: 'delivery', strength: 1.4, text: 'Orders: locate user on globe, match vendor menu, quote AVC, assign driver — say: order <item> from <vendor>.' },
    { id: 'coin', strength: 1.4, text: 'Money: coin.astranov.eu wallet for all users — balance, ledger, earn from delivery/vendor/driver work.' },
    { id: 'globe', strength: 1.3, text: 'Earth exploration: city drop-in, pins for yachts auditors coin — unified platform on one database.' },
    { id: 'social', strength: 1.2, text: 'Social: cli search users, cloud dm, profiles — Astranov is delivery + globe + search + social + AVC.' },
    { id: 'converse', strength: 1.6, text: 'Converse like an adult: short, grounded, no hallucination — use memory neurons and real app state only.' },
    { id: 'greek', strength: 1.2, text: 'Match user language — Greek or English — Arcangelo dialect ok for UI labels.' },
    { id: 'help', strength: 1.3, text: 'When unsure, offer concrete CLI: coin · order · yacht list · avc balance · unified status · db status.' },
    { id: 'brain', strength: 1.5, text: 'Brain trains on millions of scenario cycles — maturity grows, neurons strengthen, conversation becomes adult.' },
    { id: 'voice', strength: 1.2, text: 'Voice paths: coders fix lag, order pitogyra, yacht list, audit open — hotwords normalized before CLI.' },
    { id: 'boot', strength: 1.1, text: 'Boot loads commerce, yacht, auditor, coin, unified, brain — one database lkoatrkhuigdolnjsbie.' },
  ],

  _matchLocal(text) {
    const low = String(text || '').toLowerCase().trim();
    if (!low) return null;
    if (/^(hello|hi|hey|γεια|καλησπέρα|good morning|good evening)\b/.test(low)) {
      return 'Astranov Collective Intelligence — adult brain online. Delivery · globe · AVC justice coin. Say order, coin, or unified status.';
    }
    if (/^(who are you|what are you|τι είσαι)\b/.test(low)) {
      return 'I am ACI — collective brain on the globe. One database, work-based AVC, real human work mints coins.';
    }
    if (/^(brain status|brain tier)\b/.test(low)) {
      return this.statusText();
    }
    if (/^(help|\?)$/.test(low)) {
      return 'Concrete CLI: coin · order · yacht list · avc balance · unified status · db status.';
    }
    if (/^(db status|one database)\b/.test(low)) {
      return AstranovOneDatabase?.status?.()?.central
        ? 'One database lkoatrkhuigdolnjsbie — all *.astranov.eu tenants share profiles, orders, avc_ledger.'
        : 'Central database active for Astranov platform.';
    }
    return null;
  },

  learnFromScenario(scenarioId, group) {
    this.CYCLE_LEARNS++;
    this.MATURITY = Math.min(100, this.MATURITY + 0.00025);
    if (window._cycleTurbo) return;
    const g = String(group || 'boot');
    const hit = this.ADULT_NEURONS.find(n => n.id === g || scenarioId?.includes(n.id));
    if (hit) hit.strength = Math.min(3, hit.strength + 0.0002);
    if (this.CYCLE_LEARNS % 500 === 0 && ACI?.spawnNeuron) {
      const u = window._lastPos || { lat: 36.44, lng: 28.22 };
      const jitter = () => (Math.random() - 0.5) * 0.08;
      ACI.spawnNeuron(u.lat + jitter(), u.lng + jitter(), 1 + this.MATURITY * 0.01, 'learned:' + scenarioId);
    }
    if (this.CYCLE_LEARNS % 2000 === 0) this._persistLearn(scenarioId, group);
  },

  async _persistLearn(scenarioId, group) {
    try {
      await ACI?.api?.({ mode: 'teach', content: 'Scenario cycle #' + this.CYCLE_LEARNS + ' · ' + group + ' · ' + scenarioId + ' · maturity ' + this.MATURITY.toFixed(2) });
    } catch (_) { /* offline ok */ }
  },

  seedAdultNeurons() {
    const seeds = [
      { lat: 36.44, lng: 28.22 }, { lat: 37.98, lng: 23.73 }, { lat: 36.22, lng: 28.12 },
      { lat: 51.5, lng: -0.12 }, { lat: 40.7, lng: -74.0 },
    ];
    this.ADULT_NEURONS.forEach((n, i) => {
      const s = seeds[i % seeds.length];
      ACI?.spawnNeuron?.(s.lat, s.lng, n.strength, n.text);
    });
    ACI?.syncNeuronsFromPrinciples?.(this.ADULT_NEURONS.map(n => n.text));
  },

  async converse(text, opts = {}) {
    const prompt = String(text || '').trim();
    if (!prompt) return '';
    const wantsThink = opts.forceThink || prompt.length > 24 || /[?]/.test(prompt)
      || /^(explain|why|how|what is|tell me|describe|ποιος|τι είναι|πες μου|γιατί)\b/i.test(prompt);
    const local = !wantsThink ? this._matchLocal(prompt) : null;
    if (local) {
      ACI?.history?.push?.({ role: 'user', content: prompt });
      ACI?.history?.push?.({ role: 'assistant', content: local });
      ACIControl?.reply(local);
      return local;
    }
    const out = await ACI?.think?.(prompt, { fast: prompt.length < 500 }) || '';
    if (out && !/^ACI error:/i.test(out)) return out;
    const fallback = this._matchLocal(prompt) || 'Coders online — try again in a moment or say coders <task>.';
    ACIControl?.reply(fallback);
    return fallback;
  },

  statusText() {
    return 'Brain tier ' + this.maturityTier() + ' · maturity ' + this.MATURITY.toFixed(2)
      + ' · cycles learned ' + this.CYCLE_LEARNS + ' · neurons ' + (ACI?.neurons?.length || 0);
  },

  async cli(parts) {
    const sub = (parts[1] || 'status').toLowerCase();
    if (sub === 'help' || sub === '?') {
      ACIControl?.reply('brain status · brain seed · brain talk <message>');
      AciCli?.print('brain — adult conversation neurons · scenario-trained', 'ok');
      return;
    }
    if (sub === 'seed' || sub === 'adult') {
      this.seedAdultNeurons();
      ACIControl?.reply('Adult conversation neurons seeded on globe');
      return;
    }
    if (sub === 'talk' || sub === 'say' || sub === 'converse') {
      const msg = parts.slice(2).join(' ') || 'hello';
      return this.converse(msg);
    }
    AciCli?.print(this.statusText(), 'ok');
    ACIControl?.reply(this.statusText());
  },
};
window.BrainConversation = BrainConversation;