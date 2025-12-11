
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- DEBUG DUPLICATES ---')

    // 1. Find user (loose match)
    const users = await prisma.user.findMany({
        where: {
            name: { contains: 'omer', mode: 'insensitive' }
        },
        include: {
            attendances: {
                orderBy: { createdAt: 'desc' },
                take: 5
            }
        }
    })

    if (users.length === 0) {
        console.log('No user found matching "omer"')
        return
    }

    for (const user of users) {
        console.log(`User: ${user.name} (${user.email})`)

        if (user.attendances.length > 0) {
            console.log(`  Recent Attendances:`)
            for (const att of user.attendances) {
                console.log(`    ID: ${att.id}`)
                console.log(`    Shift Date: ${att.shiftDate.toISOString()}`)
                console.log(`    Check-In: ${att.checkInAt?.toISOString()} (${att.checkInAt?.toLocaleString()})`)
                console.log(`    Status: ${att.status}`)
                console.log('    ---')
            }
        } else {
            console.log('  No attendance records found.')
        }
    }

    console.log('--- END ---')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
