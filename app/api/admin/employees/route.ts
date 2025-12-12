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
        SELECT "userId", status FROM "Attendance"
    ` as any[];

    // Map attendances to users
    const usersWithAttendances = allUsers.map(u => ({
      ...u,
      attendances: allAttendances.filter(a => a.userId === u.id)
    }));

    // Filter in memory to handle stale Prisma Client
    // We filter OUT 'ADMIN' so that any other role (EMPLOYEE, MANAGER, or even undefined/unknown) is shown.
    // This is safer when the DB schema and Client are slightly out of sync.
    console.log(`[API] Fetching employees. Total users found: ${allUsers.length}`);

    const employees = usersWithAttendances.filter(u => {
      // debug log
      // console.log(`User ${u.id} (${u.name}) has role: ${u.role}`);
      return u.role !== 'ADMIN';
    });

    console.log(`[API] Returning ${employees.length} non-admin employees.`);

    // Calculate stats for each employee
    const employeesWithStats = employees.map((emp) => {
      const total = emp.attendances.length
      const onTime = emp.attendances.filter((a: any) => a.status === AttendanceStatus.ON_TIME).length
      const late = emp.attendances.filter((a: any) => a.status === AttendanceStatus.LATE).length
      const absent = emp.attendances.filter((a: any) => a.status === AttendanceStatus.ABSENT).length
      const noCheckout = emp.attendances.filter((a: any) => a.status === AttendanceStatus.NO_CHECKOUT).length

      const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0
      const lateRate = total > 0 ? Math.round((late / total) * 100) : 0
      const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0

      // Flag as "red" if late + absent rate is over 30%
      const isRedFlag = total >= 5 && (lateRate + absentRate) > 30

      // Remove attendances array from response (we only needed it for calculation)
      const { attendances, ...empWithoutAttendances } = emp

      return {
        ...empWithoutAttendances,
        stats: {
          total,
          onTime,
          late,
          absent,
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

