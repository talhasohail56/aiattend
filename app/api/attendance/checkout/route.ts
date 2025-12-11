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

