
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- DEBUG CHECKOUT LOGIC ---')

    // 1. Find a user with an open attendance (if any)
    // Or simulate one.

    // Let's create a scenario:
    // User checks in Yesterday 11pm.
    // Now it is Next Day 5am.

    // I'll search for ANY record with checkInAt != null AND checkOutAt == null
    const openRecord = await prisma.attendance.findFirst({
        where: {
            checkInAt: { not: null },
            checkOutAt: null
        },
        include: { user: true }
    })

    if (openRecord) {
        console.log('Found Open Record:')
        console.log('  User:', openRecord.user.name)
        console.log('  Shift Date:', openRecord.shiftDate)
        console.log('  Check In:', openRecord.checkInAt)

        // Verification: Does the "Shift Date Calculator" logic work for this "Now"?
        const now = new Date() // Current real time (2am PKT)
        // If the record checkIn was yesterday 9pm...
        // And now is 2am...
        // Does logic find it?

        // This confirms we should switch to "Find First Open" logic.
        console.log('Recommendation: Use findFirst({ where: { userId, checkOutAt: null } })')
    } else {
        console.log('No open records found in DB to test with. Assuming hypothetical.')
    }
}

main().finally(() => prisma.$disconnect())
