const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const userId = 'cmj1tcffx0000ejd1alxqvqgo' // Musaab

    console.log('Simulating Checkout for:', userId)

    // 1. Find record
    const attendance = await prisma.attendance.findFirst({
        where: {
            userId: userId,
            checkInAt: { not: null },
            checkOutAt: null,
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    if (!attendance) {
        console.error('ERROR: No active shift found to check out from.')
        return
    }

    console.log('Found attendance:', attendance.id)
    console.log('Shift Date:', attendance.shiftDate)

    // 2. Check Tasks
    const startOfShift = new Date(attendance.shiftDate)
    startOfShift.setHours(0, 0, 0, 0)
    const endOfShift = new Date(attendance.shiftDate)
    endOfShift.setHours(23, 59, 59, 999)

    console.log('Checking tasks between:', startOfShift, 'and', endOfShift)

    const incompleteTasks = await prisma.task.count({
        where: {
            userId: userId,
            date: {
                gte: startOfShift,
                lte: endOfShift
            },
            completed: false
        }
    })

    console.log('Incomplete Tasks:', incompleteTasks)

    if (incompleteTasks > 0) {
        console.error(`BLOCKER: You have ${incompleteTasks} incomplete task(s).`)
    } else {
        console.log('SUCCESS: Checkout would proceed.')
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
