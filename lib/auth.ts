import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
export const ADMIN_EMAIL = 'bharathsaipulipati@gmail.com'; export const SESSION_COOKIE = 'royal_mechanics_session';
export type Viewer = { id: string; email: string; displayName: string | null; role: 'ADMIN' | 'MECHANIC' | 'CUSTOMER' };
export async function hashSession(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function getViewer(): Promise<Viewer | null> { const token = (await cookies()).get(SESSION_COOKIE)?.value; if (!token || !env.DB) return null; return await env.DB.prepare('SELECT u.id, u.email, u.display_name AS displayName, u.role FROM local_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.session_hash=? AND s.expires_at>? AND u.is_allowed=1 LIMIT 1').bind(await hashSession(token), Date.now()).first<Viewer>() ?? null; }
