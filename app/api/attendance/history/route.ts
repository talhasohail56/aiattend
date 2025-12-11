import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getShiftDate } from '@/lib/attendance'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '14')
    const userIdParam = searchParams.get('userId')
    const userId = session.user.role === 'ADMIN' && userIdParam
      ? userIdParam
      : session.user.id

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
      },
      orderBy: {
        shiftDate: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ attendances })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json(
      { error: 'Failed to get history' },
      { status: 500 }
    )
  }
}


