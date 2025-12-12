
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- TABLE DEBUG START ---')
    try {
        const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `
        console.log('Tables:', result)
    } catch (e) {
        console.error('DB Error:', e)
    }
    console.log('--- TABLE DEBUG END ---')
}

main()
