import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Connect Supabase to keep your closet and saved looks. Add the project URL and server key in .env.local.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// An unguessable, HttpOnly visitor token scopes every service-role query.
// This is a guest closet, not a cross-device account.
export async function closetOwner() {
  const jar = await cookies();
  let token = jar.get('cm-closet')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString('hex');
    jar.set('cm-closet', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return createHash('sha256').update(token).digest('hex');
}

export async function imageUrl(db: ReturnType<typeof supabaseAdmin>, bucket: string, path: string) {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) throw new Error('Your photo could not load. Check the Supabase storage setup.');
  return data.signedUrl;
}
export function storageError(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : 'Your closet could not connect. Please try again.' }, { status: 503 });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
