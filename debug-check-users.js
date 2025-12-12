const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            checkInTime: true,
            checkOutTime: true
        }
    })

    console.log('User Check-In Times:')
    users.forEach(u => {
        console.log(`- ${u.name} (${u.email}): ${u.checkInTime || 'NULL (Uses Default)'} - ${u.checkOutTime || 'NULL (Uses Default)'}`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
