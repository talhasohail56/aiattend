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

        const totalOnTime = statusCounts[AttendanceStatus.ON_TIME] || 0
        const totalLate = statusCounts[AttendanceStatus.LATE] || 0
        const totalAbsent = statusCounts[AttendanceStatus.ABSENT] || 0
        const totalNoCheckout = statusCounts[AttendanceStatus.NO_CHECKOUT] || 0
        const totalEarly = statusCounts[AttendanceStatus.EARLY] || 0

        const statusDistribution = [
            { name: 'On Time', value: totalOnTime, color: '#22c55e' },
            { name: 'Late', value: totalLate, color: '#f59e0b' },
            { name: 'Absent', value: totalAbsent, color: '#ef4444' },
            { name: 'No Checkout', value: totalNoCheckout, color: '#6b7280' },
            { name: 'Early', value: totalEarly, color: '#3b82f6' },
        ]

        // Get employee count
        const employeeCount = await prisma.user.count({
            where: { role: 'EMPLOYEE' },
        })

        return NextResponse.json({
            weeklyTrends,
            statusDistribution,
            summary: {
                totalEmployees: employeeCount,
                totalOnTime,
                totalLate,
                totalAbsent,
                totalNoCheckout,
                total: totalOnTime + totalLate + totalAbsent + totalNoCheckout,
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
