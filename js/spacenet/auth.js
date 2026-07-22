/* SpaceNet auth lite — Google via Supabase (lazy SDK) */
(function (global) {
  'use strict';

  const A = {
    client: null,
    user: null,
    ready: false,
  };

  function cfg() {
    return global.SN_CONFIG || {};
  }

  function headers() {
    const h = {
      'Content-Type': 'application/json',
      apikey: cfg().sbKey || global.SB_KEY,
    };
    if (A.client) {
      /* filled async */
    }
    return h;
  }

  async function ensureClient() {
    if (A.client) return A.client;
    if (typeof supabase === 'undefined') throw new Error('auth SDK not loaded');
    const url = cfg().sbUrl || global.SB_URL;
    const key = cfg().sbKey || global.SB_KEY;
    A.client = supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
    A.client.auth.onAuthStateChange((_e, session) => {
      A.user = session?.user || null;
      paint();
    });
    const { data } = await A.client.auth.getSession();
    A.user = data?.session?.user || null;
    A.ready = true;
    paint();
    return A.client;
  }

  function paint() {
    const btn = document.getElementById('btn-login');
    const chip = document.getElementById('user-chip');
    const name =
      A.user?.user_metadata?.full_name ||
      A.user?.email?.split?.('@')?.[0] ||
      null;
    if (btn) {
      btn.textContent = A.user ? 'G' : 'G';
      btn.title = A.user ? 'Signed in as ' + (name || 'user') + ' · click to sign out' : 'Sign in with Google';
      btn.classList.toggle('in', !!A.user);
    }
    if (chip) {
      chip.textContent = name ? name.slice(0, 18) : '';
      chip.hidden = !name;
    }
    try {
      global.SNCli?.preview?.(
        A.user ? 'Signed in · ' + (name || 'user') : 'Guest · sign in G · type help'
      );
    } catch (_) {}
  }

  async function signInGoogle() {
    const c = await ensureClient();
    const origin = location.origin;
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: origin + '/',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    if (!A.client) await ensureClient();
    await A.client.auth.signOut();
    A.user = null;
    paint();
  }

  async function toggle() {
    if (A.user) {
      await signOut();
      global.SNCli?.log?.('Signed out', 'dim');
    } else {
      global.SNCli?.log?.('Opening Google sign-in…', 'dim');
      await signInGoogle();
    }
  }

  async function authHeaders() {
    const h = {
      'Content-Type': 'application/json',
      apikey: cfg().sbKey || global.SB_KEY,
    };
    try {
      await ensureClient();
      const { data } = await A.client.auth.getSession();
      const tok = data?.session?.access_token;
      h.Authorization = tok ? 'Bearer ' + tok : 'Bearer ' + (cfg().sbKey || global.SB_KEY);
    } catch (_) {
      h.Authorization = 'Bearer ' + (cfg().sbKey || global.SB_KEY);
    }
    return h;
  }

  function init() {
    if (A._bound) return;
    A._bound = true;
    document.getElementById('btn-login')?.addEventListener('click', () => {
      void toggle().catch((e) => global.SNCli?.log?.(String(e.message || e), 'err'));
    });
    // Session restore without blocking boot
    ensureClient().catch(() => {
      A.ready = true;
      paint();
    });
  }

  global.SNAuth = {
    init,
    toggle,
    signInGoogle,
    signOut,
    authHeaders,
    ensureClient,
    get user() {
      return A.user;
    },
    get ready() {
      return A.ready;
    },
  };
})(window);
