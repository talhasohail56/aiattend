const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Checking active shifts...')
    const activeShifts = await prisma.attendance.findMany({
        where: {
            checkOutAt: null,
            checkInAt: { not: null } // Just to be safe
        },
        include: {
            user: true
        }
    })

    console.log(`Found ${activeShifts.length} active shifts.`)

    for (const shift of activeShifts) {
        console.log(`User: ${shift.user.name} (${shift.userId})`)
        console.log(`  Shift Date: ${shift.shiftDate}`)
        console.log(`  Checked In: ${shift.checkInAt}`)

        // Check tasks for this date
        const startOfDay = new Date(shift.shiftDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(shift.shiftDate)
        endOfDay.setHours(23, 59, 59, 999)

        const tasks = await prisma.task.findMany({
            where: {
                userId: shift.userId,
                date: {
                    gte: startOfShift = startOfDay,
                    lte: endOfShift = endOfDay
                }
            }
        })

        console.log(`  Tasks found: ${tasks.length}`)
        tasks.forEach(t => {
            console.log(`    - [${t.completed ? 'x' : ' '}] ${t.title}`)
        })
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
