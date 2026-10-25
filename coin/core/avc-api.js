window.AvcApi = {
  async call(config, mode, payload = {}) {
    const bridge = window.AstranovAuthBridge;
    const session = bridge?.getCentralSession?.();
    const token = session?.token || config.supabaseAnonKey || '';
    const url = (config.supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/avc-ledger';
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        apikey: config.supabaseAnonKey || '',
      },
      body: JSON.stringify({ mode, ...payload }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'avc-ledger ' + r.status);
    return j;
  },
};