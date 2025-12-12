import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { userId, shiftDate, newCheckInTime, reason } = body

        if (!userId || !shiftDate || !newCheckInTime) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // shiftDate comes as ISO string (e.g. 2025-12-12T00...)
        // We should normalize it to the start of the day or however we store "Shift Date".
        // Usually shiftDate is stored as DateTime Object. 
        // We should ensure we are targeting the correct "Day".

        // For simplicity, we trust the client sends the correct "Shift Date" string which we parse back to Date.
        const date = new Date(shiftDate)

        const override = await prisma.shiftOverride.upsert({
            where: {
                userId_shiftDate: {
                    userId,
                    shiftDate: date,
                },
            },
            update: {
                newCheckInTime,
                reason,
            },
            create: {
                userId,
                shiftDate: date,
                newCheckInTime,
                reason,
            },
        })

        return NextResponse.json({ override })
    } catch (error: any) {
        console.error('Create override error:', error)
        return NextResponse.json(
            { error: 'Failed to create override' },
            { status: 500 }
        )
    }
}
