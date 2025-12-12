
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET: Fetch tasks for the current user and "shift date"
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const dateParam = searchParams.get('date') // ISO Date string (start of day)
        const userIdParam = searchParams.get('userId')

        if (!dateParam) {
            return NextResponse.json({ error: 'Date is required' }, { status: 400 })
        }

        let targetUserId = session.user.id
        if (userIdParam && userIdParam !== session.user.id) {
            // Allow both ADMIN and MANAGER to view other user's tasks
            if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
            }
            targetUserId = userIdParam
        }

        // ... (GET continuation)
        const startOfDay = new Date(queryDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(queryDate)
        endOfDay.setHours(23, 59, 59, 999)

        // Use queryRaw to bypass potential undefined 'prisma.task' on stale client
        const tasks = await prisma.$queryRaw`
            SELECT * FROM "Task"
            WHERE "userId" = ${targetUserId}
            AND "date" >= ${startOfDay}
            AND "date" <= ${endOfDay}
            ORDER BY "createdAt" ASC
        `

        return NextResponse.json({ tasks })
    } catch (error: any) {
        console.error('Fetch tasks error:', error)
        return NextResponse.json({ error: 'Failed to fetch tasks: ' + error.message }, { status: 500 })
    }
}

// POST: Admin/Manager assigns a task
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        // Allow both ADMIN and MANAGER to create tasks
        if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { userId, date, title } = body

        if (!userId || !date || !title) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        // Ensure date is stored as midnight for consistency
        const taskDate = new Date(date)
        taskDate.setHours(0, 0, 0, 0)

        const id = crypto.randomUUID()
        const now = new Date()

        // Use executeRaw to bypass potential undefined 'prisma.task'
        // We manually insert the CUID-like ID (randomUUID) and timestamps
        await prisma.$executeRaw`
            INSERT INTO "Task" ("id", "userId", "date", "title", "completed", "createdAt", "updatedAt")
            VALUES (${id}, ${userId}, ${taskDate}, ${title}, false, ${now}, ${now})
        `

        return NextResponse.json({ success: true, task: { id, userId, date: taskDate, title } })
    } catch (error: any) {
        console.error('Create task error details:', error)
        return NextResponse.json({ error: 'Failed to create task: ' + error.message }, { status: 500 })
    }
}
