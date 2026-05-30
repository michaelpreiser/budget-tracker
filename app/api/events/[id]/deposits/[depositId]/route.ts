import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; depositId: string } }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.execute({
    sql: 'DELETE FROM event_deposits WHERE id = ? AND user_id = ?',
    args: [Number(params.depositId), user.userId],
  })

  return NextResponse.json({ ok: true })
}
