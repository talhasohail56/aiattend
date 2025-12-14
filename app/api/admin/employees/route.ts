import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { createUser } from '@/lib/auth'
import { UserRole, AttendanceStatus } from '@prisma/client'
import { sendWelcomeEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    // Allow both ADMIN and MANAGER to fetch the employee list
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use queryRaw to bypass Prisma Enum validation crashing on 'MANAGER'
    const allUsers = await prisma.$queryRaw`
      SELECT 
        id, 
        name, 
        email, 
        role, 
        "checkInTime", 
        "checkOutTime", 
        "createdAt"
      FROM "User"
      ORDER BY "createdAt" DESC
    ` as any[];

    // We need to fetch attendances separately or strictly if we want stats, 
    // but for now let's just get the list working. 
    // Or we can do a raw JOIN if needed, but let's stick to simple first to fix the blocker.
    // Actually, the frontend needs 'attendances' for stats calculation.
    // Let's try to fetch attendances via standard prisma call per user? No that's N+1.
    // Let's fetch all attendances raw too.

    const allAttendances = await prisma.$queryRaw`
        SELECT "userId", status, "shiftDate" FROM "Attendance"
    ` as any[];

    // Map attendances to users
    const usersWithAttendances = allUsers.map(u => ({
      ...u,
      attendances: allAttendances.filter(a => a.userId === u.id)
    }));

    // Filter in memory to handle stale Prisma Client
    console.log(`[API] Fetching employees. Total users found: ${allUsers.length}`);

    const employees = usersWithAttendances.filter(u => {
      return u.role !== 'ADMIN';
    });

    console.log(`[API] Returning ${employees.length} non-admin employees.`);

    // Calculate stats for each employee
    const employeesWithStats = employees.map((emp) => {
      // 1. Calculate explicit stats
      const onTime = emp.attendances.filter((a: any) => a.status === AttendanceStatus.ON_TIME).length
      const late = emp.attendances.filter((a: any) => a.status === AttendanceStatus.LATE).length
      const overTime = emp.attendances.filter((a: any) => a.status === 'OVERTIME').length
      // Explicit 'ABSENT' status (e.g. manual admin override)
      const explicitAbsent = emp.attendances.filter((a: any) => a.status === AttendanceStatus.ABSENT).length
      const noCheckout = emp.attendances.filter((a: any) => a.status === AttendanceStatus.NO_CHECKOUT).length

      // 2. Calculate Inferred Absent
      // Iterate last 30 days (or since creation if newer) to find dates with NO attendance.
      let inferredAbsent = 0
      const now = new Date()
      // Normalize 'now' to start of day for comparison
      now.setHours(0, 0, 0, 0)

      const joinedDate = new Date(emp.createdAt)
      joinedDate.setHours(0, 0, 0, 0)

      // Look back 30 days max
      const lookbackDays = 30
      // Start counting from: MAX(JoinedDate, Today - 30 days)
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - lookbackDays)

      let loopDate = new Date(joinedDate > thirtyDaysAgo ? joinedDate : thirtyDaysAgo)

      // Loop until Yesterday (don't count today as absent yet unless it's past check-in time? Let's just do up to yesterday for safety)
      // Actually user asked "one employee didnt check in today". So we should include Today if query time > checkin time?
      // Simpler: Loop until Yesterday. If 'Today' is missed, it shows up tomorrow. 
      // User request implies immediate visibility. "one employee didnt check in... today".
      // Let's include Today in the loop.

      while (loopDate < now) {
        // Check if any attendance matches this loopDate (shiftDate)
        // shiftDate from DB is typically ISO string matching start of day or similar
        // We need robust comparison.
        // DB shiftDate: "2023-10-27T00:00:00.000Z" (if purely date) or "2023-10-27T22:00..."

        const hasRecord = emp.attendances.some((a: any) => {
          const aDate = new Date(a.shiftDate)
          return aDate.getDate() === loopDate.getDate() &&
            aDate.getMonth() === loopDate.getMonth() &&
            aDate.getFullYear() === loopDate.getFullYear()
        })

        if (!hasRecord) {
          inferredAbsent++
        }

        // Next day
        loopDate.setDate(loopDate.getDate() + 1)
      }

      // Total Absent = Explicit + Inferred
      const absent = explicitAbsent + inferredAbsent

      // Total "Work Days" considered = Present records + Absent days
      // Note: emp.attendances.length includes explicit records.
      // If we add inferredAbsent, we get total logical days.
      // Wait, emp.attendances includes 'explicitAbsent'.
      // So 'total' records = onTime + late + overTime + explicitAbsent + noCheckout.
      // Effective Total Days = total (records) + inferredAbsent.

      const totalRecords = emp.attendances.length
      const totalDays = totalRecords + inferredAbsent

      const onTimeRate = totalDays > 0 ? Math.round((onTime / totalDays) * 100) : 0
      const lateRate = totalDays > 0 ? Math.round((late / totalDays) * 100) : 0
      const absentRate = totalDays > 0 ? Math.round((absent / totalDays) * 100) : 0

      // Flag as "red" if late + absent rate is over 30%
      const isRedFlag = totalDays >= 5 && (lateRate + absentRate) > 30

      // Remove attendances array from response
      const { attendances, ...empWithoutAttendances } = emp

      return {
        ...empWithoutAttendances,
        stats: {
          total: totalDays,
          onTime,
          late,
          absent,
          overTime,
          noCheckout,
          onTimeRate,
          lateRate,
          absentRate,
          isRedFlag,
        },
      }
    })

    return NextResponse.json({ employees: employeesWithStats })
  } catch (error) {
    console.error('Get employees error:', error)
    return NextResponse.json(
      { error: 'Failed to get employees' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, password, role } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Validate role if provided, otherwise default to EMPLOYEE
    const userRole = (role === 'MANAGER' || role === 'ADMIN') ? role : UserRole.EMPLOYEE

    const user = await createUser(email, password, name, userRole)

    // Send credentials via email
    // We don't await this to prevent blocking the UI, or we can await to ensure it sent.
    // Let's await to log errors if any, but not fail the request if email fails (soft fail).
    try {
      await sendWelcomeEmail(email, name, password)
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
    }

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } })
  } catch (error) {
    console.error('Create employee error:', error)
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}

