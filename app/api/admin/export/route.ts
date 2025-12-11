import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { formatDate, formatDateTime } from '@/lib/attendance'
import { getLocationName } from '@/lib/location'
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
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        shiftDate: 'desc',
      },
    })

    // Generate CSV
    const headers = [
      'Employee Name',
      'Email',
      'Date',
      'Check In',
      'Check Out',
      'Status',
      'Check In Location',
      'Check Out Location',
    ]

    const rows = await Promise.all(
      attendances.map(async (attendance) => {
        const checkInLocation = attendance.checkInLatitude && attendance.checkInLongitude
          ? await getLocationName(attendance.checkInLatitude, attendance.checkInLongitude)
          : 'N/A'
        
        const checkOutLocation = attendance.checkOutLatitude && attendance.checkOutLongitude
          ? await getLocationName(attendance.checkOutLatitude, attendance.checkOutLongitude)
          : 'N/A'

        return [
          attendance.user.name,
          attendance.user.email,
          formatDate(attendance.shiftDate),
          attendance.checkInAt ? formatDateTime(attendance.checkInAt) : 'N/A',
          attendance.checkOutAt ? formatDateTime(attendance.checkOutAt) : 'N/A',
          attendance.status,
          checkInLocation,
          checkOutLocation,
        ]
      })
    )

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="attendance-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}


