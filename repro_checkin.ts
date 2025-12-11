
import { PrismaClient } from '@prisma/client'
import { getShiftDate, getAttendanceStatus } from './lib/attendance'

const prisma = new PrismaClient()

async function main() {
    try {
        const users = await prisma.user.findMany()
        console.log(`Found ${users.length} users`)

        if (users.length === 0) {
            console.log('No users found')
            return
        }

        const user = users[0]
        console.log(`Testing with user: ${user.email} (${user.id})`)

        const now = new Date()
        console.log(`Current time: ${now.toISOString()}`)
        console.log(`User CheckInTime: ${user.checkInTime}`)
        console.log(`User CheckOutTime: ${user.checkOutTime}`)

        const shiftDate = getShiftDate(now, user.checkInTime, user.checkOutTime)
        console.log(`Calculated ShiftDate: ${shiftDate.toISOString()}`)

        const existing = await prisma.attendance.findUnique({
            where: {
                userId_shiftDate: {
                    userId: user.id,
                    shiftDate,
                },
            },
            include: {
                user: true
            }
        })

        if (existing) {
            console.log('Attendance record exists:', existing)
            if (existing.checkInAt) {
                console.log('Already checked in at:', existing.checkInAt)
            } else {
                console.log('Exists but not checked in (absent or created empty?)')
            }
        } else {
            console.log('No attendance record found for this shift.')
        }

        // Identify if any error would happen duringupsert
        // We won't actually upsert to avoid messing up data, but we can check if data looks valid.

    } catch (error) {
        console.error('Error during reproduction script:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
