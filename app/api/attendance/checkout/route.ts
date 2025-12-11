import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getShiftDate, formatTime } from '@/lib/attendance'
import { AttendanceStatus } from '@prisma/client'
import { sendCheckOutEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { latitude, longitude } = body

    // Get user with their specific check-in/check-out times
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { checkInTime: true, checkOutTime: true },
    })

    const now = new Date()
    const shiftDate = getShiftDate(now, user?.checkInTime, user?.checkOutTime)

    // Find the attendance record
    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_shiftDate: {
          userId: session.user.id,
          shiftDate,
        },
      },
    })

    if (!attendance || !attendance.checkInAt) {
      return NextResponse.json(
        { error: 'No check-in found for this shift' },
        { status: 400 }
      )
    }

    if (attendance.checkOutAt) {
      return NextResponse.json(
        { error: 'Already checked out for this shift' },
        { status: 400 }
      )
    }

    // Update attendance with check-out
    const updated = await prisma.attendance.update({
      where: {
        id: attendance.id,
      },
      data: {
        checkOutAt: now,
        checkOutLatitude: latitude || null,
        checkOutLongitude: longitude || null,
        // Update status if it was NO_CHECKOUT
        status: attendance.status === AttendanceStatus.NO_CHECKOUT
          ? AttendanceStatus.ON_TIME
          : attendance.status,
      },
    })

    // Calculate duration
    const diffMs = now.getTime() - new Date(attendance.checkInAt).getTime()
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const duration = `${diffHrs}h ${diffMins}m`

    // Send email notification
    if (updated) {
      await sendCheckOutEmail(
        session.user.email!,
        session.user.name!,
        formatTime(now),
        duration
      )
    }

    return NextResponse.json({ attendance: updated })
  } catch (error) {
    console.error('Check-out error:', error)
    return NextResponse.json(
      { error: 'Failed to check out' },
      { status: 500 }
    )
  }
}

