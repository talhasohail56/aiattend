import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AttendanceStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    if (userId) where.userId = userId
    if (startDate || endDate) {
      where.shiftDate = {}
      if (startDate) where.shiftDate.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.shiftDate.lte = end
      }
    }

    const [total, present, late, absent, noCheckout] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.count({
        where: { ...where, status: { in: [AttendanceStatus.ON_TIME, AttendanceStatus.LATE] } },
      }),
      prisma.attendance.count({
        where: { ...where, status: AttendanceStatus.LATE },
      }),
      prisma.attendance.count({
        where: { ...where, status: AttendanceStatus.ABSENT },
      }),
      prisma.attendance.count({
        where: { ...where, status: AttendanceStatus.NO_CHECKOUT },
      }),
    ])

    return NextResponse.json({
      total,
      present,
      late,
      absent,
      noCheckout,
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}


