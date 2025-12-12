const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const email = 'Backbite73@gmail.com' // Abdur Rehman
    console.log(`Resetting check-in time for ${email}...`)

    await prisma.user.update({
        where: { email },
        data: {
            checkInTime: null, // Reset to use default (22:00)
            checkOutTime: null // Reset to use default (06:00)
        }
    })

    console.log('Reset complete. Abdur Rehman now uses global default (22:00).')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
