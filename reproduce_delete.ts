
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- STARTING DELETE REPRODUCTION ---')

    // 1. Create Dummy User
    const user = await prisma.user.create({
        data: {
            name: 'Delete Test User',
            email: 'delete_test@example.com',
            passwordHash: 'dummy',
            role: 'EMPLOYEE'
        }
    })
    console.log(`Created Dummy User: ${user.id}`)

    // 2. Create Dummy Attendance
    const attendance = await prisma.attendance.create({
        data: {
            userId: user.id,
            shiftDate: new Date(),
            status: 'ON_TIME',
            checkInAt: new Date()
        }
    })
    console.log(`Created Dummy Attendance: ${attendance.id}`)

    // 3. Try Deleting Attendance (Simulate "Delete Record")
    try {
        await prisma.attendance.delete({
            where: { id: attendance.id }
        })
        console.log('SUCCESS: Deleted Attendance Record')
    } catch (e: any) {
        console.error('FAILED: Could not delete attendance', e.message)
    }

    // 4. Re-create Attendance for User Deletion Test
    await prisma.attendance.create({
        data: {
            userId: user.id,
            shiftDate: new Date(),
            status: 'ON_TIME',
            checkInAt: new Date()
        }
    })
    console.log('Re-created Dummy Attendance for User Delete Test')

    // 5. Try Deleting User (Simulate "Delete Employee")
    try {
        await prisma.user.delete({
            where: { id: user.id }
        })
        console.log('SUCCESS: Deleted User (Cascade worked)')
    } catch (e: any) {
        console.error('FAILED: Could not delete user', e.message)
    }

    console.log('--- END ---')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
