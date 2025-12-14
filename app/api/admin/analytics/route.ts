import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AttendanceStatus } from '@prisma/client'
import { subDays, startOfDay, format } from 'date-fns'

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get last 7 days of data for trends
        const today = new Date()
        const sevenDaysAgo = subDays(today, 6)

        // Get daily attendance counts for the week
        const attendances = await prisma.attendance.findMany({
            where: {
                shiftDate: {
                    gte: startOfDay(sevenDaysAgo),
                    lte: today,
                },
            },
            select: {
                shiftDate: true,
                status: true,
            },
        })

        // Group by date
        const dailyData: Record<string, { onTime: number; late: number; absent: number; noCheckout: number }> = {}

        for (let i = 0; i < 7; i++) {
            const date = format(subDays(today, 6 - i), 'yyyy-MM-dd')
            dailyData[date] = { onTime: 0, late: 0, absent: 0, noCheckout: 0 }
        }

        attendances.forEach((a) => {
            const date = format(new Date(a.shiftDate), 'yyyy-MM-dd')
            if (dailyData[date]) {
                switch (a.status) {
                    case AttendanceStatus.ON_TIME:
                        dailyData[date].onTime++
                        break
                    case AttendanceStatus.LATE:
                        dailyData[date].late++
                        break
                    case AttendanceStatus.ABSENT:
                        dailyData[date].absent++
                        break
                    case AttendanceStatus.NO_CHECKOUT:
                        dailyData[date].noCheckout++
                        break
                    case AttendanceStatus.EARLY:
                        dailyData[date].onTime++ // Count early as on time for trends, or separate it? Let's count as on time for now or add a new field.
                        // Actually let's just group early with onTime for the bar chart simplicity, OR add it.
                        // The user wanted "Early Check In", implies it's good.
                        // Let's count it as onTime for the "trends" chart to match the existing graph keys [onTime, late, absent]
                        // OR we can add a new key. The chart expects [onTime, late, absent].
                        break
                }
            }
        })

        // Get employees to calculate inferred absences
        const employees = await prisma.user.findMany({
            where: { role: { not: 'ADMIN' } },
            select: { id: true, createdAt: true }
        })

        // Fetch ALL attendance history (lightweight) to accurately check past absences
        // This is necessary because looking at just "last 7 days" or "counts" isn't enough for global accurate stats
        const allAttendances = await prisma.attendance.findMany({
            select: {
                userId: true,
                shiftDate: true,
                status: true
            }
        })

        // Create a lookup set for O(1) checking: "userId-YYYY-MM-DD"
        const attendanceLookup = new Set<string>()
        allAttendances.forEach(a => {
            const dateStr = format(new Date(a.shiftDate), 'yyyy-MM-dd')
            attendanceLookup.add(`${a.userId}-${dateStr}`)
        })

        // UPDATE WEEKLY TRENDS
        Object.keys(dailyData).forEach(dateStr => {
            const d = new Date(dateStr)
            const dayOfWeek = d.getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
            // Don't count absent for today (shift might not be over) or future
            const isTodayOrFuture = d >= startOfDay(new Date())

            if (!isWeekend && !isTodayOrFuture) {
                // Check each employee
                employees.forEach(e => {
                    // Only if employee existed on this date
                    if (new Date(e.createdAt) <= d) {
                        const hasRecord = attendanceLookup.has(`${e.id}-${dateStr}`)
                        if (!hasRecord) {
                            dailyData[dateStr].absent++
                        }
                    }
                })
            }
        })

        const weeklyTrends = Object.entries(dailyData).map(([date, data]) => ({
            date: format(new Date(date), 'EEE'),
            fullDate: date,
            ...data,
        }))

        // Get overall status distribution using groupBy
        const statusGroups = await prisma.attendance.groupBy({
            by: ['status'],
            _count: {
                status: true,
            },
        })

        const statusCounts = statusGroups.reduce((acc, curr) => {
            acc[curr.status] = curr._count.status
            return acc
        }, {} as Record<string, number>)

        const totalOnTime = statusCounts['ON_TIME'] || 0
        const totalLate = statusCounts['LATE'] || 0
        const dbAbsent = statusCounts['ABSENT'] || 0
        const totalNoCheckout = statusCounts['NO_CHECKOUT'] || 0
        const totalEarly = statusCounts['EARLY'] || 0
        const totalOvertime = statusCounts['OVERTIME'] || 0
        const totalExcused = statusCounts['EXCUSED'] || 0

        // CALCULATE TOTAL ABSENT (Global inferred) BY ITERATION
        // This is the most accurate way: Check every Past Work Day for every Employee.

        // We need checkOutTime AND checkInTime for "Today" night shift logic
        const employeesWithTime = await prisma.user.findMany({
            where: { role: { not: 'ADMIN' } },
            select: {
                id: true,
                createdAt: true,
                checkOutTime: true,
                checkInTime: true
            }
        })

        let inferredTotalAbsent = 0
        const todayEnd = startOfDay(new Date())
        // We want to iterate up to "Today" to check if shift passed

        employeesWithTime.forEach(e => {
            const start = startOfDay(new Date(e.createdAt))
            const current = new Date(start)
            const now = new Date()

            while (current <= todayEnd) {
                const dayOfWeek = current.getDay()
                // We count ALL days including weekends now, as users operate on weekends.

                const dateStr = format(current, 'yyyy-MM-dd')

                // Logic for Today
                let shouldCount = true
                if (current.getTime() === todayEnd.getTime()) {
                    // It is today. Only count if shift is OVER.

                    const checkInStr = e.checkInTime || '09:00'
                    const checkOutStr = e.checkOutTime || '18:00'

                    const [inH, inM] = checkInStr.split(':').map(Number)
                    const [outH, outM] = checkOutStr.split(':').map(Number)

                    const shiftEnd = new Date(current)
                    // current is startOfDay (00:00).
                    shiftEnd.setHours(outH, outM, 0, 0)

                    // If overnight shift (CheckOut < CheckIn), then Shift End is Tomorrow
                    // e.g. In 21:00, Out 05:00. 
                    // current is Today. shiftEnd initial is Today 05:00.
                    // But for Today's shift (starts 21:00), end is Tomorrow 05:00.
                    // So we must add 1 day.
                    if (outH < inH) {
                        shiftEnd.setDate(shiftEnd.getDate() + 1)
                    }

                    // Robustness: Add 5 hours grace.
                    shiftEnd.setHours(shiftEnd.getHours() + 5)

                    if (now < shiftEnd) {
                        shouldCount = false
                    }
                }

                if (shouldCount) {
                    const hasRecord = attendanceLookup.has(`${e.id}-${dateStr}`)
                    if (!hasRecord) {
                        inferredTotalAbsent++
                    }
                }
                current.setDate(current.getDate() + 1)
            }
        })

        const totalAbsent = dbAbsent + inferredTotalAbsent

        const statusDistribution = [
            { name: 'On Time', value: totalOnTime, color: '#22c55e' },
            { name: 'Late', value: totalLate, color: '#f59e0b' },
            { name: 'Absent', value: totalAbsent, color: '#ef4444' },
            { name: 'No Checkout', value: totalNoCheckout, color: '#6b7280' },
            { name: 'Early', value: totalEarly, color: '#3b82f6' },
            { name: 'Overtime', value: totalOvertime, color: '#a855f7' },
        ]

        // Get employee count
        const employeeCount = employees.length

        return NextResponse.json({
            weeklyTrends,
            statusDistribution,
            summary: {
                totalEmployees: employeeCount,
                totalOnTime,
                totalLate,
                totalAbsent,
                totalNoCheckout,
                totalOvertime,
                // Total is now simply sum of all records + inferred absents 
                // (This represents "Total Shifts Expected" essentially)
                total: totalOnTime + totalLate + totalAbsent + totalNoCheckout + totalEarly + totalOvertime
            },
        })
    } catch (error) {
        console.error('Get analytics error:', error)
        return NextResponse.json(
            { error: 'Failed to get analytics' },
            { status: 500 }
        )
    }
}
