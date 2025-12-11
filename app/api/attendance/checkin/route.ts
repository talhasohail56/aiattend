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
    const checkInTimeStr = user?.checkInTime || '21:00' // fallback to default if not found

    // We need to compare NOW with SCHEDULED_TIME
    // NOW and SCHEDULED_TIME must both be absolute timestamps.
    // SCHEDULED_TIME = (ShiftDate YYYY-MM-DD) + (CheckInTime HH:mm) + (PKT Offset)

    // 1. Get Shift Date YYYY-MM-DD (This is essentially correct from getShiftDate logic, as it subtracts day if needed)
    // However, d.setHours() in getShiftDate might set UTC hours. 
    // Let's rely on shiftDate.toISOString() date part? No, that's UTC date part.
    // We need the "Wall Clock Date".

    // Construct Scheduled Time robustly:
    // Create a string "YYYY-MM-DDTHH:mm:00+05:00" assuming PKT (Standard)
    // Or just use the native date methods shifted.

    // Hacky but robust for Vercel/PKT pair:
    // shiftDate is the "Start Date". 
    // If shiftDate (from getShiftDate) says "Dec 11" (in UTC representation), it means the shift implies Dec 11.
    const year = shiftDate.getFullYear()
    const month = String(shiftDate.getMonth() + 1).padStart(2, '0')
    const day = String(shiftDate.getDate()).padStart(2, '0') // This is UTC Day.
    // If getShiftDate ran on Vercel (UTC), and it said "Dec 11", it used UTC 'now'.
    // If 'now' was 18:00 UTC (Dec 11), shiftDate is Dec 11.
    // We want "Dec 11 23:00 PKT".
    // 23:00 PKT is 18:00 UTC.
    // "2025-12-11T23:00:00+05:00"

    const scheduledIsoString = `${year}-${month}-${day}T${checkInTimeStr}:00+05:00`
    // Note: This +05:00 hardcoding is risky if DEFAULT_TIMEZONE changes, 
    // but without a heavy library, parsing "Asia/Karachi" to offset is hard.
    // Since env DEFAULT_TIMEZONE is Asia/Karachi, we assume +05:00.

    const scheduledCheckIn = new Date(scheduledIsoString)

    // Calculate difference in minutes (scheduled - now)
    const diffMinutes = (scheduledCheckIn.getTime() - now.getTime()) / (1000 * 60)

    console.log('CheckIn Debug:', {
      now: now.toISOString(),
      scheduledIsoString,
      scheduledCheckIn: scheduledCheckIn.toISOString(),
      diffMinutes
    })

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

