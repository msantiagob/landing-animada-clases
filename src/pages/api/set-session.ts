export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { idToken } = await request.json();
    if (!idToken) return new Response('Missing token', { status: 400 });

    // Verificar token con Firebase REST API (sin firebase-admin)
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${import.meta.env.PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!res.ok) return new Response('Invalid token', { status: 401 });

    const data = await res.json();
    const email: string = data.users?.[0]?.email ?? '';

    if (email !== import.meta.env.OWNER_EMAIL) {
      return new Response('Forbidden', { status: 403 });
    }

    cookies.set('dashboard_session', '1', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24h
      path: '/',
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Server error', { status: 500 });
  }
};
