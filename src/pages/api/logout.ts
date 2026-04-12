export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = ({ cookies }) => {
  cookies.delete('dashboard_session', { path: '/' });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
