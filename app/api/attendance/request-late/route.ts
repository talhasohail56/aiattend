import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { sendLateRequestEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { shiftDate, requestedTime, reason } = body

        if (!shiftDate || !requestedTime || !reason) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Save Request
        const lateRequest = await prisma.lateRequest.create({
            data: {
                userId: session.user.id,
                shiftDate: new Date(shiftDate),
                requestedTime,
                reason,
                status: 'PENDING'
            }
        })

        // Get Admins
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { email: true }
        })

        // Generate Links
        // Base URL needed.
        const protocol = req.headers.get('x-forwarded-proto') || 'http'
        const host = req.headers.get('host')
        const baseUrl = `${protocol}://${host}`

        const approveLink = `${baseUrl}/api/admin/requests/${lateRequest.id}/approve`
        const rejectLink = `${baseUrl}/api/admin/requests/${lateRequest.id}/reject`

        // Send Emails
        await Promise.all(admins.map(admin => {
            if (admin.email) {
                return sendLateRequestEmail(
                    admin.email,
                    session.user.name!,
                    shiftDate,
                    requestedTime,
                    reason,
                    approveLink,
                    rejectLink
                )
            }
        }))

        return NextResponse.json({ success: true, lateRequest })
    } catch (error: any) {
        console.error('Late request error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to submit request' },
            { status: 500 }
        )
    }
}
