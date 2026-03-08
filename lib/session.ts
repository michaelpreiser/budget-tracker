import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import db from './db'

const COOKIE = 'bt-session'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

/** Create a session token in the DB and set the cookie. Call from Route Handlers only. */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString('hex')
  await db.execute({
    sql: "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, datetime('now'))",
    args: [token, userId],
  })
  cookies().set(COOKIE, token, COOKIE_OPTS)
}

/** Return the authenticated user, or null. Call from Route Handlers only. */
export async function getAuthUser(): Promise<{ userId: number; username: string } | null> {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  const result = await db.execute({
    sql: 'SELECT s.user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?',
    args: [token],
  })
  const row = result.rows[0]
  if (!row) return null
  return { userId: Number(row.user_id), username: row.username as string }
}

/** Delete the session from DB and clear the cookie. Call from Route Handlers only. */
export async function destroySession(): Promise<void> {
  const token = cookies().get(COOKIE)?.value
  if (token) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] })
  }
  cookies().set(COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 })
}
