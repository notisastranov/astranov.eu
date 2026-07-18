/**
 * Astranov origin rescue — proxy astranov.eu → working CF Pages build.
 * Fixes dead Vercel shell (critical 404 → CLI-only, no globe).
 */
const DEFAULT_ORIGIN = 'https://astranov.pages.dev';

export default {
  async fetch(request, env) {
    const origin = (env.ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
    const url = new URL(request.url);

    // Build target on pages.dev (same path/query)
    const target = new URL(url.pathname + url.search, origin + '/');

    // Clone request for GET/HEAD (most static assets)
    const init = {
      method: request.method,
      headers: new Headers(request.headers),
      redirect: 'manual',
    };
    init.headers.delete('host');
    // Avoid sending Vercel-specific cookies to Pages
    init.headers.delete('cookie');

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      // @ts-ignore
      init.duplex = 'half';
    }

    let res;
    try {
      res = await fetch(target.toString(), init);
    } catch (e) {
      return new Response('Astranov origin proxy error: ' + (e.message || e), {
        status: 502,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    // Pass through with cache-friendly headers for static JS
    const out = new Headers(res.headers);
    out.set('x-astranov-proxy', 'pages');
    out.set('x-astranov-origin', origin);
    // Force revalidation of HTML so users escape stuck SW/CDN
    if (url.pathname === '/' || url.pathname.endsWith('.html')) {
      out.set('cache-control', 'no-store, max-age=0, must-revalidate');
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: out,
    });
  },
};
