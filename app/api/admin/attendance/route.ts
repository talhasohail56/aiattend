import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AttendanceStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status') as AttendanceStatus | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    if (userId) where.userId = userId
    if (status) where.status = status
    if (startDate || endDate) {
      where.shiftDate = {}
      if (startDate) where.shiftDate.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.shiftDate.lte = end
      }
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        shiftDate: 'desc',
      },
      take: 1000,
    })

    // Backfill Absent Logic (Only if userId is provided, for Employee Detail View)
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, checkInTime: true, checkOutTime: true, createdAt: true, name: true, email: true }
      })

      if (user) {
        const filledHistory: any[] = []
        // Determine date range
        // Default to 30 days if no dates provided, or use provided range

        let start = startDate ? new Date(startDate) : new Date()
        if (!startDate) start.setDate(start.getDate() - 30) // Default 30 days back

        let end = endDate ? new Date(endDate) : new Date()

        // Cap start date at user creation date (don't show absent before they existed)
        if (user.createdAt > start) {
          start = new Date(user.createdAt)
        }
        // Normalize start to beginning of day
        start.setHours(0, 0, 0, 0)

        // Loop from end to start (descending)
        const current = new Date(end)
        current.setHours(hours(user.checkInTime), minutes(user.checkInTime), 0, 0)
        // Actually, we should iterate by "Shift Date"
        // Let's iterate days from End down to Start.

        const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24))

        // Helper to parsing HH:MM
        const getHM = (t: string | null) => {
          if (!t) return [9, 0]
          return t.split(':').map(Number)
        }
        const [inH, inM] = getHM(user.checkInTime)

        for (let i = 0; i <= dayDiff; i++) {
          // Construct the Shift Date for this day
          // We want to check if a shift *started* on this day.
          // let shiftDate = new Date(end) - i days...

          const d = new Date(end)
          d.setDate(d.getDate() - i)

          // If d < start, break (handled by loop limit mostly, but specific logic useful)
          if (d < start) break;

          // Don't count "Future" if d is Today and it's not late yet?
          // For admin view, maybe just show what we have.
          // If d > Now, skip.
          if (d.getTime() > new Date().getTime()) continue;

          // Set d to Shift Start time
          d.setHours(inH, inM, 0, 0)

          // Use simple matching
          const existing = attendances.find(a => {
            const shift = new Date(a.shiftDate)
            // Approx match
            return Math.abs(shift.getTime() - d.getTime()) < 1000 * 60 * 60 * 12 // Within 12 hours?
            // Or stricter: Same Day/Month/Year relative to shift start?
            // Safest: Same YYYY-MM-DD
          })

          // Better matching:
          // Check if any attendance falls within [d - 2h, d + 12h]?
          // Let's stick to the find logic used in history: Match Date Parts.
          const existingExact = attendances.find(a => {
            const s = new Date(a.shiftDate)
            // Adjust for timezone offset if necessary, but here likely both in server time or Date obj
            return s.getDate() === d.getDate() && s.getMonth() === d.getMonth() && s.getFullYear() === d.getFullYear()
          })

          if (existingExact) {
            filledHistory.push(existingExact)
          } else {
            // If day is Today...
            const now = new Date()
            const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()

            // If it's today, only mark absent if strictly late? 
            // Or just don't show "Absent" for today in Admin View to avoid confusion.
            if (!isToday) {
              filledHistory.push({
                id: `absent_${d.getTime()}`,
                shiftDate: d.toISOString(),
                checkInAt: null,
                checkOutAt: null,
                status: 'ABSENT',
                user: { id: user.id || userId, name: user.name, email: user.email }
              })
            }
          }
        }

        return NextResponse.json({ attendances: filledHistory })
      }
    }

    return NextResponse.json({ attendances })
  } catch (error) {
    console.error('Get attendance error:', error)
    return NextResponse.json(
      { error: 'Failed to get attendance' },
      { status: 500 }
    )
  }
}

function hours(t: string | null) { return t ? parseInt(t.split(':')[0]) : 9 }
function minutes(t: string | null) { return t ? parseInt(t.split(':')[1]) : 0 }


