
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        select: {
            email: true,
            name: true,
            checkInTime: true,
            checkOutTime: true,
            role: true
        }
    })

    console.log('--- USER CONFIGURATIONS ---')
    users.forEach(user => {
        console.log(`User: ${user.name} (${user.email})`)
        console.log(`- Role: ${user.role}`)
        console.log(`- Schedule: ${user.checkInTime || 'Default'} - ${user.checkOutTime || 'Default'}`)
        console.log('-------------------------')
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
