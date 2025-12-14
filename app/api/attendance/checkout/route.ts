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

    // Enforce location
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      return NextResponse.json(
        { error: 'Location access is required to check out. Please enable location services.' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Find the latest OPEN attendance record (CheckIn not null, CheckOut null)
    // We order by createdAt desc to get the most recent one.
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId: session.user.id,
        checkInAt: { not: null },
        checkOutAt: null,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!attendance) {
      return NextResponse.json(
        { error: 'No active shift found to check out from.' },
        { status: 400 }
      )
    }

    if (attendance.checkOutAt) {
      // Should be unreachable due to query, but safe check
      return NextResponse.json(
        { error: 'Already checked out.' },
        { status: 400 }
      )
    }


    // CHECK FOR INCOMPLETE TASKS
    // Get the start of the "shift date" for this attendance
    // attendance.shiftDate is a DateTime object.
    const startOfShift = new Date(attendance.shiftDate)
    startOfShift.setHours(0, 0, 0, 0)
    const endOfShift = new Date(attendance.shiftDate)
    endOfShift.setHours(23, 59, 59, 999)

    // Use queryRaw to bypass potential undefined 'prisma.task' on stale client
    const tasksResult = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Task"
        WHERE "userId" = ${session.user.id}
        AND "date" >= ${startOfShift}
        AND "date" <= ${endOfShift}
        AND "completed" = false
    ` as any[]

    const incompleteTasks = tasksResult[0]?.count || 0

    if (incompleteTasks > 0) {
      return NextResponse.json(
        { error: `You have ${incompleteTasks} incomplete task(s). Please complete them before checking out.` },
        { status: 400 }
      )
    }

    // Calculate if Overtime
    let newStatus = attendance.status
    const OVERTIME_THRESHOLD_MINUTES = 30 // Consider Overtime if > 30 mins after scheduled end? Or just > 0?
    // Let's use the explicit checkOutTime from user or default
    // We need to fetch the user settings again or assume defaults.
    // Ideally, we compare 'now' vs 'scheduledCheckOutTime' for that shift.
    // Since we don't have easy access to scheduled time here without re-fetching user settings/overrides, 
    // we can rely on the logic that determined the shift date.

    // Retrieve User's CheckOut Time
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { checkOutTime: true }
    })

    if (user) {
      const scheduledCheckOut = user.checkOutTime || process.env.CHECK_OUT_TIME || '06:00'
      const [schedHours, schedMinutes] = scheduledCheckOut.split(':').map(Number)

      // Determine Scheduled CheckOut Date/Time
      // We know attendance.shiftDate. We need to apply schedHours/Minutes to it.
      // If overnight (Checkout < CheckIn), likely next day.
      // But simpler: just construct the checkout time relative to the shift date.

      const shiftDate = new Date(attendance.shiftDate)
      const scheduledEndDate = new Date(shiftDate)
      scheduledEndDate.setHours(schedHours, schedMinutes, 0, 0)

      // Handle Overnight Adjustment
      // If we are checking out at like 7AM, and shift started 10PM yesterday.
      // If scheduled checkout is 6AM.
      // If 'schedHours' is small (morning) and shiftDate refers to 'evening start', we add 1 day.
      // Generally if CheckOutTime < CheckInTime (e.g. 06:00 < 22:00).
      // Let's grab CheckInTime to be sure.
      const checkInTimeStr = process.env.CHECK_IN_TIME || '22:00' // Approximation if user generic.
      const [inHours] = checkInTimeStr.split(':').map(Number)

      if (schedHours < inHours) {
        scheduledEndDate.setDate(scheduledEndDate.getDate() + 1)
      }

      // If Now > Scheduled + Threshold?
      // User requested "Overtime" as an option.
      if (now.getTime() > scheduledEndDate.getTime()) {
        // It is overtime.
        newStatus = 'OVERTIME' as AttendanceStatus
      }
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
        status: newStatus
      },
    })

    // Calculate duration
    // attendance.checkInAt is guaranteed by the query { checkInAt: { not: null } }
    const checkInTime = attendance.checkInAt ? new Date(attendance.checkInAt).getTime() : now.getTime()
    const diffMs = now.getTime() - checkInTime
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const duration = `${diffHrs}h ${diffMins}m`

    // Send email notification
    // Send email notification
    try {
      if (updated && session.user.email && session.user.name) {
        await sendCheckOutEmail(
          session.user.email,
          session.user.name,
          formatTime(now),
          duration
        )
      }
    } catch (emailError) {
      console.error('Failed to send check-out email:', emailError)
      // Continue execution - do not fail checkout
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

