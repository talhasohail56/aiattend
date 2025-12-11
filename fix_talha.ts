
import { PrismaClient } from '@prisma/client'
import { getAttendanceStatus } from './lib/attendance'

const prisma = new PrismaClient()

async function main() {
    console.log('--- FIXING TALHA ATTENDANCE ---')

    // 1. Find the specific LATE attendance
    const user = await prisma.user.findFirst({
        where: { name: { contains: 'Talha', mode: 'insensitive' } }
    })

    if (!user) {
        console.log('User Talha not found')
        return
    }

    const attendance = await prisma.attendance.findFirst({
        where: {
            userId: user.id,
            status: 'LATE'
        },
        orderBy: { createdAt: 'desc' }
    })

    if (!attendance) {
        console.log('No LATE attendance found for Talha')
        return
    }

    console.log('Found Attendance:', attendance.id)
    console.log('Current Shift Date:', attendance.shiftDate)
    console.log('Current Status:', attendance.status)

    // 2. Fix it
    // We believe the correct Shift Date is Dec 11 (Today)
    const correctShiftDate = new Date(attendance.shiftDate)
    correctShiftDate.setDate(correctShiftDate.getDate() + 1) // Add 1 day

    console.log('New Shift Date:', correctShiftDate)

    // Update
    await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
            shiftDate: correctShiftDate, // Fix date
            status: 'ON_TIME'            // Fix status
        }
    })

    console.log('SUCCESS: Updated attendance to ON_TIME and fixed ShiftDate.')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
