
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'omersid2003@gmail.com' },
        select: { name: true, role: true }
    })
    console.log('Role Check:', user)
}

main().finally(() => prisma.$disconnect())
