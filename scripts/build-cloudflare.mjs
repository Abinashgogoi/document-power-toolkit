import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/server', { recursive: true });

const worker = `const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; worker-src 'self' blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response('Static asset binding unavailable', { status: 503, headers: SECURITY_HEADERS });
    }
    let response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get('Accept')?.includes('text/html');
    if (response.status === 404 && request.method === 'GET' && acceptsHtml) {
      const fallbackUrl = new URL('/index.html', request.url);
      response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    }
    return withSecurityHeaders(response);
  },
};
`;

await writeFile('dist/server/index.js', worker, 'utf8');
