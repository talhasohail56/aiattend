
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function POST(
    req: NextRequest,
    { params }: { params: { taskId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { taskId } = params

        // Verify ownership (or admin)
        const task = await prisma.task.findUnique({
            where: { id: taskId }
        })

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        if (task.userId !== session.user.id && session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Toggle
        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: {
                completed: !task.completed
            }
        })

        return NextResponse.json({ success: true, task: updatedTask })
    } catch (error) {
        console.error('Toggle task error:', error)
        return NextResponse.json({ error: 'Failed to toggle task' }, { status: 500 })
    }
}
