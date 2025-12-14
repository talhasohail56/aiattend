import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AttendanceStatus } from '@prisma/client'
import { startOfDayPKT, formatDatePKT } from '@/lib/attendance'

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

    // If userId is provided, we backfill for that user only (optimized).
    // If NO userId is provided, we might still want to show Absent records if status is ABSENT or All.
    // However, backfilling for ALL users across ALL time is heavy.
    // Let's implement a constrained backfill:
    // 1. Fetch all employees.
    // 2. Generate absent records for the requested date range (or last 7 days default if no range).

    // We only do this if we are NOT filtering by a specific status that ISN'T active (i.e. if status is ON_TIME, don't generate absent).
    // If status is ABSENT or null (All), we generate.

    const shouldGenerateAbsent = !status || status === 'ABSENT'

    // If userId was handled above, great. If not (userId is null), we do it for all.
    // We reuse the logic but generalized.

    let mixedResults: any[] = [...attendances]

    if (shouldGenerateAbsent && !userId) {
      // Fetch valid employees
      const employees = await prisma.user.findMany({
        where: { role: { not: 'ADMIN' } },
        select: { id: true, name: true, email: true, createdAt: true, checkInTime: true, checkOutTime: true }
      })

      // Determine date range
      let start = startDate ? new Date(startDate) : new Date()
      if (!startDate) start.setDate(start.getDate() - 7) // Default to last 7 days to keep it light? Or 30?
      // Let's do 7 days for "All" view to prevent flooding, unless explicitly filtered by date.
      // User asked "why records not showing". If they select "Absent" filter with no date, they expect history.
      // Let's do 30 days if 'status' is ABSENT, else 7 days for generic view?
      if (!startDate && status === 'ABSENT') {
        start = new Date()
        start.setDate(start.getDate() - 30)
      }

      let end = endDate ? new Date(endDate) : new Date()

      // Normalize
      start.setHours(0, 0, 0, 0)

      // Iterate each employee
      for (const emp of employees) {
        // Same logic as before
        let empStart = new Date(start)
        if (emp.createdAt > empStart) empStart = new Date(emp.createdAt)
        empStart.setHours(0, 0, 0, 0)

        const dayDiff = Math.ceil((end.getTime() - empStart.getTime()) / (1000 * 3600 * 24))
        const [inH, inM] = getHM(emp.checkInTime)

        // Loop days - iterate using PKT dates
        const todayPKT = formatDatePKT(new Date())

        for (let i = 0; i <= dayDiff; i++) {
          const d = new Date(end)
          d.setDate(d.getDate() - i)
          d.setHours(0, 0, 0, 0) // Midnight UTC for consistent handling

          if (d < empStart) break;

          // Get this date in PKT format for consistent comparison
          const dDatePKT = formatDatePKT(d)

          // Skip future dates (in PKT)
          if (dDatePKT > todayPKT) continue;

          // Check if attendance exists for this date
          const exists = attendances.find(a => {
            const aDatePKT = formatDatePKT(new Date(a.shiftDate))
            return a.userId === emp.id && aDatePKT === dDatePKT
          })

          if (!exists) {
            // Check if today (in PKT) and if shift has passed
            const isToday = dDatePKT === todayPKT

            // For today, only mark absent if shift time has passed
            if (isToday) {
              // Get check-in/out times - use env defaults for overnight business
              const checkInDefault = process.env.CHECK_IN_TIME || '22:00'
              const checkOutDefault = process.env.CHECK_OUT_TIME || '06:00'
              const checkOutStr = emp.checkOutTime || checkOutDefault
              const checkInStr = emp.checkInTime || checkInDefault
              const [outH] = checkOutStr.split(':').map(Number)
              const [inHUser] = checkInStr.split(':').map(Number)

              // For overnight shifts (checkout < checkin), shift ends tomorrow
              // So today's shift hasn't ended yet if it's overnight
              if (outH < inHUser) {
                // Overnight shift - today's shift ends tomorrow, so skip today entirely
                continue
              }

              // For day shift, check if checkout time + grace has passed (using PKT hours)
              const now = new Date()
              const nowPKTHour = parseInt(new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Karachi',
                hour: 'numeric',
                hour12: false
              }).format(now))

              const shiftEndHour = outH + 2 // 2 hours grace
              if (nowPKTHour < shiftEndHour) {
                // Shift hasn't ended yet
                continue
              }
            }

            // Past day or shift has ended - mark as absent
            // Create shiftDate at midnight PKT for correct display
            const shiftDatePKT = startOfDayPKT(d)
            mixedResults.push({
              id: `absent_${emp.id}_${shiftDatePKT.getTime()}`,
              shiftDate: shiftDatePKT.toISOString(),
              checkInAt: null,
              checkOutAt: null,
              status: 'ABSENT',
              user: { id: emp.id, name: emp.name, email: emp.email },
              checkInLatitude: null, checkInLongitude: null,
              checkOutLatitude: null, checkOutLongitude: null
            })
          }
        }
      }
    } else if (userId && shouldGenerateAbsent) {
      // ... Logic from before (lines 51-149) ...
      // Actually, we can just replace the specific block with generic block or adapt.
      // For minimal code churn, let's keep the dedicated block structure but merge result.
      // The previous block returned JSON immediately. We should change that to return a merged list.

      // Let's rewrite the userId block to push to mixedResults instead of returning immediately.

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, checkInTime: true, checkOutTime: true, createdAt: true, name: true, email: true }
      })

      if (user) {
        let start = startDate ? new Date(startDate) : new Date()
        if (!startDate) start.setDate(start.getDate() - 30)
        let end = endDate ? new Date(endDate) : new Date()
        if (user.createdAt > start) start = new Date(user.createdAt)
        start.setHours(0, 0, 0, 0)

        const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24))
        const [inH, inM] = getHM(user.checkInTime)

        for (let i = 0; i <= dayDiff; i++) {
          const d = new Date(end)
          d.setDate(d.getDate() - i)
          if (d < start) break;
          if (d.getTime() > new Date().getTime()) continue;
          d.setHours(inH, inM, 0, 0)

          const exists = attendances.find(a => isSameDay(new Date(a.shiftDate), d))
          if (!exists) {
            const now = new Date()
            if (!isSameDay(d, now)) {
              mixedResults.push({
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
      }
    }

    // Filter mixedResults by status if needed (since we added ABSENT, but if user asked for LATE, generateAbsent was false)
    if (status && status !== 'ABSENT') {
      // If status was ON_TIME, we didn't generate absent.
      // If status was ABSENT, we generated absent AND included DB records. 
      // We should filter DB records that are NOT absent?
      // DB records query 'where.status = status'. So they are already filtered.
      // So mixedResults is fine.
    }

    // Sort mixedResults by shiftDate desc
    mixedResults.sort((a, b) => new Date(b.shiftDate).getTime() - new Date(a.shiftDate).getTime())

    return NextResponse.json({ attendances: mixedResults })
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
function isSameDay(d1: Date, d2: Date) {
  // Use PKT-aware date formatting for consistent comparison
  return formatDatePKT(d1) === formatDatePKT(d2)
}

function getHM(t: string | null) {
  if (!t) return [9, 0]
  return t.split(':').map(Number)
}
