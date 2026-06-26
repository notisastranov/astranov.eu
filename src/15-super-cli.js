// === SUPER CLI — one window: toolbar + log + stage + input ===
const SuperCli = {
  _bound: false,

  init() {
    if (this._bound) return;
    this._bound = true;
    this.bindToolbar();
    GlobeDeck?.setTitle('Super CLI — Collective');
  },

  bindToolbar() {
    const actions = {
      'aci-login': () => Auth?.user ? Auth.signOut() : Auth?.signInGoogle(),
      'aci-cli-toggle': () => GlobeDeck?.toggle(),
      'aci-stop': () => userIntervene?.(),
      'aci-mic': () => {
        if (Voice?.speaking || voiceSessionActive) userIntervene?.();
        else startVoiceOptions?.();
      },
      'aci-locate': () => this.run('locate'),
      'aci-order': () => this.run('order'),
      'aci-batch': () => this.run('batch'),
      'aci-vhf': () => this.run('vhf'),
      'aci-call': () => this.run('phone'),
    };
    Object.entries(actions).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.onclick = e => { e.preventDefault(); e.stopPropagation(); fn(); };
    });
  },

  async run(action, opts) {
    const act = String(action || '').toLowerCase();
    GlobeDeck?.superAction(act, opts);
    AciCli?.print('▸ ' + act, 'cmd');

    switch (act) {
      case 'locate':
        locateMe?.();
        GlobeDeck?.finishCliIfOneShot('locate');
        break;
      case 'order':
        await Commerce?.showPicker?.(opts?.filter);
        break;
      case 'batch':
        await AstranovNode?.launchBatch?.();
        break;
      case 'vhf':
      case 'radio':
      case 'pmr':
        Comms?.startVHF?.();
        break;
      case 'phone':
      case 'call':
        GlobeDeck?.hideStage();
        GlobeDeck?.expand('Super CLI — phone');
        AciCli?.print('Type: call +30… (e.g. call +306912345678)', 'ok');
        ACIControl?.reply('Type call +number in Super CLI');
        document.getElementById('aci-cli-in')?.focus();
        break;
      case 'news':
        NewsFeed?.flash?.();
        GlobeDeck?.finishCliIfOneShot('news');
        break;
      case 'drive':
        DrivingView?.activate?.();
        break;
      case 'cli':
        GlobeDeck?.expand('Super CLI');
        document.getElementById('aci-cli-in')?.focus();
        break;
      default:
        if (AciCli && act) await AciCli.run(act + (opts?.rest ? ' ' + opts.rest : ''));
    }
  },
};
window.SuperCli = SuperCli;