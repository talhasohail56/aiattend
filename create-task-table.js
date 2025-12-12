
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- MANUAL TABLE CREATION START ---')
    try {
        // 1. Create Table
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Task" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "title" TEXT NOT NULL,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
      );
    `)
        console.log('Task Table Created (or already exists).')

        // 2. Create Indices
        try {
            await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Task_userId_idx" ON "Task"("userId");`)
            console.log('Index userId created.')
        } catch (e) { console.log('Index userId error (ignorable):', e.message) }

        try {
            await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Task_date_idx" ON "Task"("date");`)
            console.log('Index date created.')
        } catch (e) { console.log('Index date error (ignorable):', e.message) }

        // 3. Add Foreign Key
        try {
            await prisma.$executeRawUnsafe(`
            ALTER TABLE "Task" 
            ADD CONSTRAINT "Task_userId_fkey" 
            FOREIGN KEY ("userId") 
            REFERENCES "User"("id") 
            ON DELETE CASCADE ON UPDATE CASCADE;
        `)
            console.log('Foreign Key added.')
        } catch (e) {
            // FK might already exist
            console.log('FK Error (ignorable):', e.message)
        }

    } catch (e) {
        console.error('CRITICAL DB Error:', e)
    }
    console.log('--- MANUAL TABLE CREATION END ---')
}

main()
