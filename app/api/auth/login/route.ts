import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { createSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    console.log('[login] attempt:', JSON.stringify(username), 'pwd length:', password?.length)

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    const result = await db.execute({
      sql: 'SELECT id, username, password_hash FROM users WHERE username = ?',
      args: [username.trim()],
    })
    const row = result.rows[0]
    console.log('[login] db row found:', !!row, 'username in db:', row?.username)
    console.log('[login] hash prefix:', (row?.password_hash as string)?.slice(0, 20))

    if (!row) {
      console.log('[login] no user found')
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, row.password_hash as string)
    console.log('[login] password match:', passwordMatch)

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    await createSession(Number(row.id))
    return NextResponse.json({ username: row.username })
  } catch (err) {
    console.error('[login] error:', err)
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 })
  }
}
