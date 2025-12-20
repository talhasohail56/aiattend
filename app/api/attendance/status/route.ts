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

    // Get user with their specific check-in/check-out times
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { checkInTime: true, checkOutTime: true },
    })

    // FIRST: Check for any active/open shift (checked in but not checked out)
    // This ensures employees can check out even when working overtime past their scheduled end time
    const activeShift = await prisma.attendance.findFirst({
      where: {
        userId: session.user.id,
        checkInAt: { not: null },
        checkOutAt: null,
      },
      orderBy: {
        shiftDate: 'desc',  // Get the most recent SHIFT DATE, not just most recently created
      },
    })

    // If there's an active shift, return it regardless of calculated shift date
    if (activeShift) {
      return NextResponse.json({ attendance: activeShift })
    }

    // Otherwise, fall back to checking for today's calculated shift date
    const now = new Date()
    const shiftDate = getShiftDate(now, user?.checkInTime, user?.checkOutTime)

    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_shiftDate: {
          userId: session.user.id,
          shiftDate,
        },
      },
    })

    // Logic Fix: If we found an attendance record, but it's checked out, 
    // AND the current time suggests we might be in a new shift window relative to that record's completion,
    // we should return null to allow a new check-in.
    // However, the shiftDate key is unique. If getShiftDate returns the SAME date, we CANNOT create a new record.
    // If getShiftDate returns a date that matches attendance.shiftDate, it means we are still in that "shift day".
    // If the user checked out early and wants to check in again for the SAME shift, our schema (unique userId_shiftDate) prevents it.
    // We will return the attendance as is, because the UI handles "Shift Complete". 
    // If the user wants to check in again, they technically can't for the same 'shiftDate'.
    // BUT, if `getShiftDate` is returning "Yesterday" (because now < checkoutTime), but the user actually wants to work "Today" (early start?),
    // that's a deeper logic issue in `getShiftDate`.

    // For now, simply returning the attendance is correct based on the schema.
    // The UI fix I made (Welcome Card logic) should address the user's confusion.

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}

