import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { currentPassword, newUsername, newPassword } = await request.json()

    const result = await db.execute({
      sql: 'SELECT password_hash FROM users WHERE id = ?',
      args: [user.userId],
    })
    const row = result.rows[0]

    if (!row || !(await bcrypt.compare(currentPassword ?? '', row.password_hash as string))) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
    }

    if (newUsername) {
      const trimmed = newUsername.trim()
      if (!trimmed) return NextResponse.json({ error: 'Username cannot be empty.' }, { status: 400 })
      try {
        await db.execute({
          sql: 'UPDATE users SET username = ? WHERE id = ?',
          args: [trimmed, user.userId],
        })
      } catch {
        return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 })
      }
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 })
      }
      const hash = await bcrypt.hash(newPassword, 10)
      await db.execute({
        sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
        args: [hash, user.userId],
      })
    }

    const updatedResult = await db.execute({
      sql: 'SELECT id, username FROM users WHERE id = ?',
      args: [user.userId],
    })
    const updated = updatedResult.rows[0]
    return NextResponse.json({ username: updated.username })
  } catch (err) {
    console.error('Account update error:', err)
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  }
}
