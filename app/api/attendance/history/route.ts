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
    // Fetch user settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { checkInTime: true, checkOutTime: true, createdAt: true }
    })

    // Helper to generate Shift Date string YYYY-MM-DD
    // DB stores ShiftDate as Date object at CheckInTime.

    // Let's iterate 0 to limit-1
    for (let i = 0; i < limit; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i) // Today, Yesterday, ...

      // Stop if we go before user creation (ignore time part for creation day safety)
      // Actually, if created today, i=0 is valid. if created yesterday, i=0,1 valid.
      // If d < createdAt (normalized), break or skip.

      if (user?.createdAt) {
        const created = new Date(user.createdAt)
        created.setHours(0, 0, 0, 0) // Start of created day

        const currentDay = new Date(d)
        currentDay.setHours(0, 0, 0, 0)

        if (currentDay < created) break; // Don't show history before creation
      }

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
        // Gap filling disabled per user request
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


