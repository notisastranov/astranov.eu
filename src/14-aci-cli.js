// === ACI CLI — Collective dev terminal (login required) ===
const AciCli = {
  open: false,
  buffer: '',

  init() {
    const input = document.getElementById('aci-cli-in');
    const toggle = document.getElementById('aci-cli-toggle');
    if (toggle) toggle.onclick = () => this.toggle();
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const v = input.value.trim();
          if (v) {
            this.handle(v);
            input.value = '';
            this.buffer = '';
            window.resizeCliInput?.(input);
          }
          e.preventDefault();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const sug = this.suggest(input.value);
          if (sug) {
            input.value = sug;
            this.buffer = sug;
            window.resizeCliInput?.(input);
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.clear();
        }
      };
      input.oninput = () => {
        this.buffer = input.value;
        window.resizeCliInput?.(input);
      };
      input.onfocus = () => { this.open = true; GlobeDeck?.expand?.('CLI'); };
    }
  },

  toggle() {
    this.open = !this.open;
    const input = document.getElementById('aci-cli-in');
    if (this.open) {
      GlobeDeck?.expand?.('CLI');
      input?.focus();
    } else {
      input?.blur();
      if (!GlobeDeck?.thinking) GlobeDeck?.collapse?.();
    }
  },

  clear() {
    const input = document.getElementById('aci-cli-in');
    if (input) { input.value = ''; this.buffer = ''; window.resizeCliInput?.(input); }
    GlobeDeck?.clearLog?.();
  },

  print(t, cls) { GlobeDeck?.log?.(t, cls); },

  async handle(line) {
    const parts = line.trim().split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const rest = parts.slice(1).join(' ');
    const voiceSessionActive = !!(window.Voice && Voice.session);

    if (!cmd) return;
    if (cmd === 'help' || cmd === '?') {
      this.print('think <p> | evolve | teach <t> | stats | seed | coders <task> | code <edit> | db <change> | theme auto|dark|bright | clear | exit', 'dim');
      return;
    }
    if (cmd === 'clear') { this.clear(); return; }
    if (cmd === 'exit' || cmd === 'close') { GlobeDeck?.completeTask('cli'); return; }
    if (cmd === 'logout') { await Auth.signOut(); this.print('signed out', 'ok'); return; }

    if (cmd === 'theme' || cmd === 'dark' || cmd === 'bright' || cmd === 'light' || cmd === 'auto') {
      let mode = cmd === 'theme' ? (parts[1] || '').toLowerCase() : (cmd === 'light' ? 'bright' : cmd);
      if (mode === 'auto' || mode === 'system') mode = 'auto';
      AstranovTheme?.set?.(mode);
      this.print('theme → ' + (AstranovTheme?._auto ? 'auto' : AstranovTheme?.mode || 'dark'), 'ok');
      return;
    }
    if (cmd === 'code' || cmd === 'edit') {
      if (!rest) { this.print('usage: code <desc>', 'err'); return; }
      GlobeDeck.activeTask = 'coders';
      AciCoders?.handleMessage?.('edit code: ' + rest);
      this.print('code change sent to coders', 'ok');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'db' || cmd === 'database') {
      if (!rest) { this.print('usage: db <cmd>', 'err'); return; }
      try {
        const r = await ACI.api({ mode: 'db', detail: rest });
        this.print('db: ' + (r.text || 'ok'), 'ok');
      } catch (e) {
        this.print('db err, try coders', 'err');
        AciCoders?.handleMessage?.('db change: ' + rest);
      }
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'think') {
      if (!rest) { ACIControl?.reply('usage: think <prompt>'); return; }
      const r = await ACI.think(rest);
      ACIControl?.reply(r || '(empty)');
      if (voiceSessionActive && Voice.shouldSpeak(r)) speak(r.slice(0, 200));
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    // ... other commands unchanged
    if (cmd === 'evolve' || cmd === 'e') {
      const r = await ACI.evolve(rest);
      ACIControl?.reply(r || '(evolved)');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'teach') {
      if (!rest) { this.print('usage: teach <content>', 'err'); return; }
      const r = await ACI.teach(rest);
      this.print(r?.ok ? 'taught' : (r?.error || 'fail'), r?.ok ? 'ok' : 'err');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'stats' || cmd === 's') {
      const r = await ACI.api({ mode: 'stats' });
      this.print(r?.text || JSON.stringify(r).slice(0,300), 'out');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'seed') {
      const r = await ACI.api({ mode: 'seed' });
      this.print(r?.text || 'seeded', 'ok');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'council' || cmd === 'c') {
      const r = await ACI.api({ mode: 'council' });
      this.print(r?.verdict || r?.text || 'council', 'out');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'coders' || cmd === 'composer' || cmd === 'cursor' ||
        (cmd === 'summon' && /^coders?$/i.test(parts[1] || ''))) {
      const task = cmd === 'summon' ? rest : (cmd === 'coders' ? rest : rest || '');
      if (!task) { this.print('usage: coders <task desc>', 'err'); return; }
      if (!Auth?.user) {
        this.print('sign in with G first', 'err');
        Auth?.openLoginModal?.('Sign in to use coders');
        return;
      }
      GlobeDeck.activeTask = 'coders';
      AciCoders?.handleMessage?.(task);
      this.print('coders task sent', 'ok');
      return;
    }
    if (cmd === 'vendor' || cmd === 'v') {
      await Commerce?.showPicker?.();
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'order' || cmd === 'o') {
      if (!rest) { this.print('usage: order <item>', 'err'); return; }
      const r = await Commerce?.placeOrder?.(rest);
      this.print(r?.ok ? 'ordered' : (r?.error || 'fail'), r?.ok ? 'ok' : 'err');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'batch' || cmd === 'node') {
      AstranovNode?.showPanel?.();
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'radio' || cmd === 'vhf') {
      Comms?.startVHF?.();
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    ACIControl?.reply('unknown — try help');
  },

  suggest(prefix) {
    const p = (prefix || '').toLowerCase();
    const cmds = ['think', 'evolve', 'teach', 'stats', 'seed', 'council', 'coders', 'code', 'db', 'theme', 'auto', 'dark', 'bright', 'vendor', 'order', 'batch', 'radio', 'clear', 'exit', 'logout'];
    for (const c of cmds) if (c.startsWith(p)) return c;
    return '';
  }
};
window.AciCli = AciCli;