
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- PLAIN TEXT PASSWORD RESET START ---')
    try {
        const newPassword = 'password123'

        console.log(`Resetting passwords for all EMPLOYEES to PLAIN TEXT '${newPassword}'...`)

        // Update only employees to use plain text password
        const count = await prisma.$executeRaw`
        UPDATE "User"
        SET "passwordHash" = ${newPassword}
        WHERE role = 'EMPLOYEE'
    `

        console.log(`Updated ${count} users.`)

    } catch (e) {
        console.error('RESET Error:', e)
    }
    console.log('--- PLAIN TEXT PASSWORD RESET END ---')
}

main()
