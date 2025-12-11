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

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '14')
    const userIdParam = searchParams.get('userId')
    const userId = session.user.role === 'ADMIN' && userIdParam
      ? userIdParam
      : session.user.id

    // 1. Fetch actual records
    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
      },
      orderBy: {
        shiftDate: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // 2. Generate date range and fill gaps
    const filledHistory: any[] = []
    const now = new Date()
    // Align now to simple date part for iteration
    // Use the getShiftDate logic or simple Date iteration?
    // Let's iterate back 'limit' days.

    // We need to know the User's CheckIn Time to properly construct "Shift Dates" 
    // to match what is in the DB.
    // Fetch user settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { checkInTime: true, checkOutTime: true }
    })

    // Helper to generate Shift Date string YYYY-MM-DD
    // DB stores ShiftDate as Date object at CheckInTime.

    // Let's iterate 0 to limit-1
    for (let i = 0; i < limit; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i) // Today, Yesterday, ...

      // We need the "Shift Date" corresponding to this wall-clock day.
      // If we use our helper getShiftDate(d, ...):
      // It returns the correct ShiftDate object for that day.
      const targetShiftDate = getShiftDate(d, user?.checkInTime, user?.checkOutTime)

      // Find in actual records
      // Compare by ISO string date part or range? 
      // Prisma stores exact DateTime. 
      // getShiftDate returns exact DateTime matching the one stored (if logic is verifying).

      // We need fuzzy match or exact match?
      // Let's try to match by Day/Month/Year
      const existing = attendances.find(a => {
        const shift = new Date(a.shiftDate)
        return shift.getDate() === targetShiftDate.getDate() &&
          shift.getMonth() === targetShiftDate.getMonth() &&
          shift.getFullYear() === targetShiftDate.getFullYear()
      })

      if (existing) {
        filledHistory.push(existing)
      } else {
        // Don't show "Absent" for Future dates?
        // If targetShiftDate is Today... and it's not yet checkout time? 
        // Or if we haven't checked in yet?
        // Absent implies "Shift Ended and No Show".

        // Allow "Today" to be empty (Upcoming) or Absent?
        // If i==0 (Today), and no record:
        // It might be "Upcoming". We shouldn't mark "Absent" yet.
        // Let's skip i=0 if no record? 
        // But the user wants to see "Absent" for missed days.

        // Simple rule: If day is fully passed, mark absent.
        // If day is Today:
        // Check if Now > CheckInTime + Threshold?
        // If it is 2am and shift was 9pm, and no record -> Absent (or late pending).

        // For simplicity in this iteration:
        // If i > 0 (Yesterday and before) -> Mark Absent
        // If i == 0 (Today) -> Ignore (User sees timer on dashboard)

        if (i > 0) {
          filledHistory.push({
            id: `temp_${i}`,
            shiftDate: targetShiftDate.toISOString(),
            checkInAt: null,
            checkOutAt: null,
            status: 'ABSENT',
            user: { name: 'You' } // Placeholder
          })
        }
      }
    }

    // filledHistory is in Reverse Chronological order (Today -> Past) which matches UI expectation

    return NextResponse.json({ attendances: filledHistory })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json(
      { error: 'Failed to get history' },
      { status: 500 }
    )
  }
}


