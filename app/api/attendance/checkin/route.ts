import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getShiftDate, getAttendanceStatus, formatTime } from '@/lib/attendance'
import { AttendanceStatus } from '@prisma/client'
import { sendCheckInEmail } from '@/lib/email'

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

    // Check if already checked in for this shift
    const existing = await prisma.attendance.findUnique({
      where: {
        userId_shiftDate: {
          userId: session.user.id,
          shiftDate,
        },
      },
    })

    if (existing && existing.checkInAt) {
      return NextResponse.json(
        { error: 'Already checked in for this shift' },
        { status: 400 }
      )
    }

    // Create or update attendance record
    const status = getAttendanceStatus(now, shiftDate, user?.checkInTime)
    const attendance = await prisma.attendance.upsert({
      where: {
        userId_shiftDate: {
          userId: session.user.id,
          shiftDate,
        },
      },
      update: {
        checkInAt: now,
        checkInLatitude: latitude || null,
        checkInLongitude: longitude || null,
        status,
      },
      create: {
        userId: session.user.id,
        shiftDate,
        checkInAt: now,
        checkInLatitude: latitude || null,
        checkInLongitude: longitude || null,
        status,
      },
    })

    // Send email notification
    try {
      if (attendance) {
        await sendCheckInEmail(
          session.user.email!,
          session.user.name!,
          formatTime(attendance.checkInAt),
          status
        )
      }
    } catch (emailError) {
      console.error('Failed to send check-in email:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ attendance })
  } catch (error: any) {
    console.error('Check-in error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check in' },
      { status: 500 }
    )
  }
}

