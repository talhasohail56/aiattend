import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getUserCheckInTime, getUserCheckOutTime } from '@/lib/attendance'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { checkInTime: true, checkOutTime: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check for today's override
    // Calculate "Today's Shift Date" logic (same as checkin route)
    // If it's 3AM on Friday, it's typically Thursday's shift (9PM Thu - 5AM Fri)
    // BUT user/times is used for "Next Check In".
    // If it's 2PM Friday, we want Friday's check in (e.g. 9PM or overridden).
    // If it's 2AM Friday, we are IN Thursday's shift. The "Next Check In" is Friday 9PM.
    // So we usually care about the *upcoming* or *current* shift start.

    // Simple logic: Look for override for "Today" and "Yesterday".
    // Actually, dashboard uses this for "Time Left".
    // If I'm late (it is now after start time), I need Today's override.
    // Let's check for an override for the date of "Now" (if before 5AM, maybe yesterday, but let's stick to standard date for now and refine if needed).
    // Actually, consistent with `attendance.ts`:
    // The shiftDate is the date the shift STARTS.

    const now = new Date()
    // Normalizing "Today" to strings YYYY-MM-DD
    // If it's before 5AM, we might be in yesterday's shift, but for "Next Checkin" (which is today's evening), we want Today.
    // If we are currently IN a shift (e.g. 2AM), dashboard handles that logic separately ("SHIFT ACTIVE").
    // The "Time Left" is usually for the future start.

    // Let's assume we want valid override for "Today" (local time).
    // Note: Database stores ShiftDate as DateTime at 00:00:00 UTC usually.
    // We need to match how we save it. `new Date(string)` creates UTC probably?
    // Let's grab overrides around now.

    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    const override = await prisma.shiftOverride.findFirst({
      where: {
        userId: session.user.id,
        shiftDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })

    return NextResponse.json({
      checkInTime: override?.newCheckInTime || user.checkInTime || '09:00',
      checkOutTime: user.checkOutTime || '17:00'
    })
  } catch (error) {
    console.error('Get user times error:', error)
    return NextResponse.json(
      { error: 'Failed to get user times' },
      { status: 500 }
    )
  }
}


