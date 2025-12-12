const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const userId = 'cmj1tcffx0000ejd1alxqvqgo' // Musaab

    // Find the duplicate shifts
    const shifts = await prisma.attendance.findMany({
        where: {
            userId: userId,
            checkOutAt: null
        },
        orderBy: {
            shiftDate: 'asc'
        }
    })

    console.log(`Found ${shifts.length} active shifts for Musaab.`)

    if (shifts.length > 1) {
        // We expect one at 21:00 (Late) and one at 22:00 (On Time)
        // We want to DELETE the older/wrong one (21:00)
        // shiftDate is DateTime.
        const toDelete = shifts[0] // Valid assumption if sorted by date? 21:00 < 22:00.
        console.log(`Deleting shift with date: ${toDelete.shiftDate} (Status: ${toDelete.status})`)

        await prisma.attendance.delete({
            where: { id: toDelete.id }
        })
        console.log('Deleted successfully.')
    } else {
        console.log('No duplicates found.')
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
