import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db, { seedCategories } from '@/lib/db'
import { createSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    if (!username?.trim() || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)
    let userId: number
    try {
      const result = await db.execute({
        sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        args: [username.trim(), hash],
      })
      userId = Number(result.lastInsertRowid)
    } catch {
      return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 })
    }

    await seedCategories(db, userId)
    await createSession(userId)
    return NextResponse.json({ username: username.trim() }, { status: 201 })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 })
  }
}
