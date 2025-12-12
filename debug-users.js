
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- DB DEBUG START ---')
    try {
        const users = await prisma.user.findMany()
        console.log(`Total Users: ${users.length}`)
        users.forEach(u => {
            console.log(`ID: ${u.id}, Name: ${u.name}, Role: ${u.role} (Type: ${typeof u.role})`)
        })
    } catch (e) {
        console.error('DB Error:', e)
    }
    console.log('--- DB DEBUG END ---')
}

main()
