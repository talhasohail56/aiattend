import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getUserCheckInTime, getUserCheckOutTime } from '@/lib/attendance'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { checkInTime: true, checkOutTime: true },
    })

    return NextResponse.json({
      checkInTime: getUserCheckInTime(user?.checkInTime),
      checkOutTime: getUserCheckOutTime(user?.checkOutTime),
    })
  } catch (error) {
    console.error('Get user times error:', error)
    return NextResponse.json(
      { error: 'Failed to get user times' },
      { status: 500 }
    )
  }
}


