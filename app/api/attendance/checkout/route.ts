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

    // Update attendance with check-out
    const updated = await prisma.attendance.update({
      where: {
        id: attendance.id,
      },
      data: {
        checkOutAt: now,
        checkOutLatitude: latitude || null,
        checkOutLongitude: longitude || null,
        // Update status if it was NO_CHECKOUT (though usually status is set at CheckIn)
        // If we want to mark "Completed", we leave status as is (late/ontime)
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

