// ... (abbreviated for the key addition; full in src)
      if (cmd === 'code' || cmd === 'edit') {
        if (!rest) { this.out('usage: code <desc of change>', 'err'); return { handled: true, error: 'empty' }; }
        GlobeDeck.activeTask = 'coders';
        await AciCoders?.handleMessage?.('edit code: ' + rest);
        this.out('code edit queued to coders for src changes', 'ok');
        return { handled: true };
      }
      if (cmd === 'db' || cmd === 'database') {
        if (!rest) { this.out('usage: db <cmd for DB change>', 'err'); return { handled: true }; }
        try {
          const r = await this.api({ mode: 'db', detail: rest });
          this.out('db: ' + (r.text || 'ok'), 'ok');
        } catch (e) {
          this.out('db: use coders for ' + rest, 'dim');
          await AciCoders?.handleMessage?.('db change: ' + rest);
        }
        return { handled: true };
      }