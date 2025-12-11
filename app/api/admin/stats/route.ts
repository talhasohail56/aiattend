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

    const [total, present, late, absentDb, noCheckout] = await Promise.all([
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

    // Calculate synthetic absences if userId is present
    let finalAbsent = absentDb

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true }
      })

      if (user) {
        // Determine calculation range
        let start = startDate ? new Date(startDate) : new Date(user.createdAt)
        if (user.createdAt > start) start = new Date(user.createdAt)

        let end = endDate ? new Date(endDate) : new Date()
        if (end > new Date()) end = new Date() // Cap at today

        // Normalize
        start.setHours(0, 0, 0, 0)
        end.setHours(0, 0, 0, 0)

        const dayDiff = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24)))

        // Total expected days (excluding today potentially? logic varies, let's say up to yesterday to match 'attendance' api)
        // But we need to subtract weekends if we want to be fancy. For now, assume 7-day work week or valid days.
        // Assumption: Every day is a working day.

        // Total Records found in this range
        // We need to re-query count for this specific range if 'where' didn't already have it? 
        // 'where' has the date filters if provided.

        // If date filters provided, 'total' is count in range.
        // If we assume working every day:
        // Expected = dayDiff
        // Absent = Expected - TotalRecords (Present+Late+NoCheckout+AbsentDB)
        // Be careful not to double count.

        // Any record (status ANY) counts as "Attendance Data Exists".
        // So Absent = Expected - total

        const calculatedAbsent = Math.max(0, dayDiff - total)
        finalAbsent += calculatedAbsent
      }
    }

    return NextResponse.json({
      total,
      present,
      late,
      absent: finalAbsent,
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


