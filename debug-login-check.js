
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- LOGIN DEBUG START ---')
    try {
        // 1. Dump all users
        const allUsers = await prisma.$queryRaw`SELECT id, name, email, role, "passwordHash" FROM "User"`
        console.log(`Total Users Found: ${allUsers.length}`)
        allUsers.forEach(u => {
            console.log(`User: ${u.name}`)
            console.log(`  Email: '${u.email}'`)
            console.log(`  Role: ${u.role}`)
            console.log(`  Hash Length: ${u.passwordHash ? u.passwordHash.length : 'MISSING'}`)
            console.log('---')
        })

        // 2. Test Fetch by Email (Simulate Login)
        // Let's pick an employee from the list if possible, or just log the query attempt for one.
        const emp = allUsers.find(u => u.role === 'EMPLOYEE')
        if (emp) {
            console.log(`Testing Login Fetch for Employee: ${emp.email}`)
            const fetched = await prisma.$queryRaw`
            SELECT id, name, email, role, "passwordHash"
            FROM "User"
            WHERE email = ${emp.email}
            LIMIT 1
        `
            const user = fetched[0]
            console.log('Fetch Result:', user ? 'FOUND' : 'NOT FOUND')

            if (user) {
                console.log('Fetched Role:', user.role)

                // Verify Password
                try {
                    const bcrypt = require('bcryptjs')
                    const isMatch = await bcrypt.compare('password', user.passwordHash)
                    console.log(`Password 'password' match: ${isMatch}`)

                    const isMatch2 = await bcrypt.compare('password123', user.passwordHash)
                    console.log(`Password 'password123' match: ${isMatch2}`)
                } catch (e) {
                    console.log('Bcrypt error:', e.message)
                }
            }
        } else {
            console.log('No Employee found to test.')
        }

    } catch (e) {
        console.error('DEBUG Error:', e)
    }
    console.log('--- LOGIN DEBUG END ---')
}

main()
