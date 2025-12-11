
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- DEBUG TALHA ---')

    // 1. Find user (loose match)
    const users = await prisma.user.findMany({
        where: {
            name: { contains: 'Talha', mode: 'insensitive' }
        },
        include: {
            attendances: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    })

    if (users.length === 0) {
        console.log('No user found matching "Talha"')
        return
    }

    for (const user of users) {
        console.log(`User: ${user.name} (${user.email})`)
        console.log(`  Scheduled Check-In: ${user.checkInTime}`)
        console.log(`  Scheduled Check-Out: ${user.checkOutTime}`)

        if (user.attendances.length > 0) {
            const att = user.attendances[0]
            console.log(`  Latest Attendance:`)
            console.log(`    ID: ${att.id}`)
            console.log(`    Shift Date: ${att.shiftDate.toISOString()}`)
            console.log(`    Check-In At: ${att.checkInAt?.toISOString()} (Local: ${att.checkInAt?.toLocaleString()})`)
            console.log(`    Status: ${att.status}`)
        } else {
            console.log('  No attendance records found.')
        }
    }

    console.log('--- END ---')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
