
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
    console.log('--- PASSWORD RESET START ---')
    try {
        const newPassword = 'password123'
        const newHash = await bcrypt.hash(newPassword, 10)

        console.log(`Resetting passwords for all EMPLOYEES to '${newPassword}'...`)

        // Update only employees
        // We use executeRawUnsafe and ensure correct quoting for Postgres
        // Postgres string literals use single quotes.
        // user input is simple string so safe to interpolate carefully or use params if supported,
        // but executeRaw supports tagged template literals which is best.

        const count = await prisma.$executeRaw`
        UPDATE "User"
        SET "passwordHash" = ${newHash}
        WHERE role = 'EMPLOYEE'
    `

        console.log(`Updated ${count} users.`)

    } catch (e) {
        console.error('RESET Error:', e)
    }
    console.log('--- PASSWORD RESET END ---')
}

main()
