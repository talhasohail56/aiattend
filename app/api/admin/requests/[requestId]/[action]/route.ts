import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendLateRequestDecisionEmail } from '@/lib/email'

export async function GET(
    req: NextRequest,
    { params }: { params: { requestId: string; action: string } }
) {
    const { requestId, action } = params

    try {
        const request = await prisma.lateRequest.findUnique({
            where: { id: requestId },
            include: { user: true }
        })

        if (!request) {
            return new NextResponse('Request not found', { status: 404 })
        }

        if (request.status !== 'PENDING') {
            return new NextResponse(`Request already ${request.status}`, { status: 400 })
        }



        if (action === 'approve') {
            // Update Request
            await prisma.lateRequest.update({
                where: { id: requestId },
                data: { status: 'APPROVED' }
            })

            // Create Override
            await prisma.shiftOverride.upsert({
                where: {
                    userId_shiftDate: {
                        userId: request.userId,
                        shiftDate: request.shiftDate
                    }
                },
                update: {
                    newCheckInTime: request.requestedTime,
                    reason: `Late Request Approved: ${request.reason}`
                },
                create: {
                    userId: request.userId,
                    shiftDate: request.shiftDate,
                    newCheckInTime: request.requestedTime,
                    reason: `Late Request Approved: ${request.reason}`
                }
            })

            // Notify Employee
            if (request.user.email) {
                await sendLateRequestDecisionEmail(
                    request.user.email,
                    request.user.name || 'Employee',
                    new Date(request.shiftDate).toDateString(),
                    'APPROVED'
                )
            }

            return new NextResponse(`
                <html>
                    <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f0fdf4;">
                        <h1 style="color: #166534;">Request Approved</h1>
                        <p>Shift override created for <strong>${request.user.name}</strong>.</p>
                        <p>New time: ${request.requestedTime}</p>
                    </body>
                </html>
            `, { headers: { 'Content-Type': 'text/html' } })

        } else if (action === 'reject') {
            await prisma.lateRequest.update({
                where: { id: requestId },
                data: { status: 'REJECTED' }
            })

            // Notify Employee
            if (request.user.email) {
                await sendLateRequestDecisionEmail(
                    request.user.email,
                    request.user.name || 'Employee',
                    new Date(request.shiftDate).toDateString(),
                    'REJECTED'
                )
            }

            return new NextResponse(`
                <html>
                    <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #fef2f2;">
                        <h1 style="color: #991b1b;">Request Rejected</h1>
                        <p>The request has been marked as rejected.</p>
                    </body>
                </html>
            `, { headers: { 'Content-Type': 'text/html' } })
        }

        return new NextResponse('Invalid action', { status: 400 })

    } catch (error) {
        console.error('Request action error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
