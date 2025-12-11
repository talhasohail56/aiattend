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
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        checkInTime: true,
        checkOutTime: true,
        createdAt: true,
        attendances: {
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            attendances: true,
          },
        },
      },
    })

    // Calculate stats for each employee
    const employeesWithStats = employees.map((emp) => {
      const total = emp.attendances.length
      const onTime = emp.attendances.filter((a) => a.status === AttendanceStatus.ON_TIME).length
      const late = emp.attendances.filter((a) => a.status === AttendanceStatus.LATE).length
      const absent = emp.attendances.filter((a) => a.status === AttendanceStatus.ABSENT).length
      const noCheckout = emp.attendances.filter((a) => a.status === AttendanceStatus.NO_CHECKOUT).length

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
    const { name, email, password } = body

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

    const user = await createUser(email, password, name, UserRole.EMPLOYEE)

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

