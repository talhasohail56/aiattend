import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

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
    const { checkInTime, checkOutTime, password } = body

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

    const data: any = {
      checkInTime: checkInTime || null,
      checkOutTime: checkOutTime || null,
    }

    if (password) {
      data.passwordHash = await hashPassword(password)
    }

    // Role update
    // if (body.role && (body.role === 'ADMIN' || body.role === 'MANAGER' || body.role === 'EMPLOYEE')) {
    //   data.role = body.role
    // }

    // Use standard update for everything except role
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        checkInTime: true,
        checkOutTime: true,
      },
    })

    // If role is provided, force update it with raw query to bypass potential stale enum cache
    if (body.role && (body.role === 'ADMIN' || body.role === 'MANAGER' || body.role === 'EMPLOYEE')) {
      try {
        // Try updating directly
        await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = '${body.role}'::"UserRole" WHERE "id" = '${params.id}'`);
      } catch (roleError: any) {
        console.error('Role update failed, attempting to patch Enum:', roleError);
        // If validation fails, it might be because MANAGER is not in the Enum. Try to add it.
        // Note: internal transactions might fail if alter runs inside one, but let's try.
        try {
          await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS '${body.role}'`);
          // Retry update
          await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = '${body.role}'::"UserRole" WHERE "id" = '${params.id}'`);
        } catch (retryError) {
          console.error('Role update rewrite failed:', retryError);
          throw retryError; // Re-throw to main catch
        }
      }
    }

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Update employee error details:', error)
    return NextResponse.json(
      { error: 'Failed to update employee: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('DELETE Employee request received for ID:', params.id)
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
