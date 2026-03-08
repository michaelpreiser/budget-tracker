import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { createSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    const result = await db.execute({
      sql: 'SELECT id, username, password_hash FROM users WHERE username = ?',
      args: [username.trim()],
    })
    const row = result.rows[0]

    if (!row || !(await bcrypt.compare(password, row.password_hash as string))) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    await createSession(Number(row.id))
    return NextResponse.json({ username: row.username })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 })
  }
}
