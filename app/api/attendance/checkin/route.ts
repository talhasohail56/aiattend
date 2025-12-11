import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getShiftDate, getAttendanceStatus, formatTime } from '@/lib/attendance'
import { AttendanceStatus } from '@prisma/client'
import { sendCheckInEmail, sendLateNotificationEmail } from '@/lib/email'

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

    // strict check: Allow max 1 hour early
    const checkInTimeStr = user?.checkInTime || '21:00' // fallback to default if not found, but usually exists
    const [scheduledHours, scheduledMinutes] = checkInTimeStr.split(':').map(Number)

    // Construct scheduled Check-In Time for this shift
    const scheduledCheckIn = new Date(shiftDate)
    scheduledCheckIn.setHours(scheduledHours, scheduledMinutes, 0, 0)

    // Calculate difference in minutes (scheduled - now)
    // If now is 19:00 and scheduled is 21:00, diff is 120 mins
    const diffMinutes = (scheduledCheckIn.getTime() - now.getTime()) / (1000 * 60)

    // If trying to check in more than 60 minutes early
    if (diffMinutes > 60) {
      return NextResponse.json(
        { error: 'Too early. You can only check in 1 hour before your shift.' },
        { status: 400 }
      )
    }

    // Check if already checked in for this shift
    const existing = await prisma.attendance.findUnique({
      where: {
        userId_shiftDate: {
          userId: session.user.id,
          shiftDate,
        },
      },
    })

    if (existing) {
      if (existing.checkOutAt) {
        return NextResponse.json(
          { error: 'You have already completed your shift for this date.' },
          { status: 400 }
        )
      }
      if (existing.checkInAt) {
        return NextResponse.json(
          { error: 'You are already checked in.' },
          { status: 400 }
        )
      }
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
        // 1. Notify Employee
        await sendCheckInEmail(
          session.user.email!,
          session.user.name!,
          formatTime(attendance.checkInAt),
          status
        )

        // 2. Notify Admins if LATE
        if (status === AttendanceStatus.LATE) {
          const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { email: true }
          })

          // Send emails in parallel
          await Promise.all(admins.map(admin => {
            if (admin.email) {
              return sendLateNotificationEmail(
                admin.email,
                session.user.name!,
                formatTime(attendance.checkInAt),
                status
              )
            }
          }))
        }
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

