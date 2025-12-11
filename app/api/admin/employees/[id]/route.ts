import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

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
    const { checkInTime, checkOutTime } = body

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (checkInTime && !timeRegex.test(checkInTime)) {
      return NextResponse.json(
        { error: 'Invalid check-in time format. Use HH:mm (e.g., 21:00)' },
        { status: 400 }
      )
    }
    if (checkOutTime && !timeRegex.test(checkOutTime)) {
      return NextResponse.json(
        { error: 'Invalid check-out time format. Use HH:mm (e.g., 05:00)' },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        checkInTime: true,
        checkOutTime: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Update employee error:', error)
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete employee (attendances will cascade delete due to onDelete: Cascade)
    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete employee error:', error)
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    )
  }
}
