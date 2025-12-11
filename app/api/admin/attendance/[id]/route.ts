import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getAttendanceStatus } from '@/lib/attendance'
import { AttendanceStatus } from '@prisma/client'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { checkInAt, checkOutAt, checkInLatitude, checkInLongitude, checkOutLatitude, checkOutLongitude } = body

    const attendance = await prisma.attendance.findUnique({
      where: { id: params.id },
    })

    if (!attendance) {
      return NextResponse.json(
        { error: 'Attendance not found' },
        { status: 404 }
      )
    }

    // Determine status if check-in time is provided
    let status = attendance.status
    if (checkInAt) {
      status = getAttendanceStatus(new Date(checkInAt), attendance.shiftDate)
    }

    // If check-out is missing but check-in exists, mark as NO_CHECKOUT
    if (checkInAt && !checkOutAt && status !== AttendanceStatus.ABSENT) {
      status = AttendanceStatus.NO_CHECKOUT
    }

    const updated = await prisma.attendance.update({
      where: { id: params.id },
      data: {
        checkInAt: checkInAt ? new Date(checkInAt) : null,
        checkOutAt: checkOutAt ? new Date(checkOutAt) : null,
        checkInLatitude: checkInLatitude ?? attendance.checkInLatitude,
        checkInLongitude: checkInLongitude ?? attendance.checkInLongitude,
        checkOutLatitude: checkOutLatitude ?? attendance.checkOutLatitude,
        checkOutLongitude: checkOutLongitude ?? attendance.checkOutLongitude,
        status,
      },
    })

    return NextResponse.json({ attendance: updated })
  } catch (error) {
    console.error('Update attendance error:', error)
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('DELETE Attendance request received for ID:', params.id)
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.attendance.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete attendance error:', error)
    return NextResponse.json(
      { error: 'Failed to delete attendance' },
      { status: 500 }
    )
  }
}


