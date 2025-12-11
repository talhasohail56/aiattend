
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- DEBUG LATEST ATTENDANCE ---')

    // Get latest attendance
    const latest = await prisma.attendance.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { user: true }
    })

    if (!latest) {
        console.log('No attendance records found.')
        return
    }

    console.log('User:', latest.user.name)
    console.log('User Settings - CheckIn:', latest.user.checkInTime, 'CheckOut:', latest.user.checkOutTime)

    console.log('Record details:')
    console.log('  ID:', latest.id)
    console.log('  Status:', latest.status)
    console.log('  CreatedAt (UTC):', latest.createdAt.toISOString())
    console.log('  CheckInAt (UTC):', latest.checkInAt?.toISOString())
    console.log('  CheckInAt (Local):', latest.checkInAt?.toLocaleString())
    console.log('  ShiftDate (UTC):', latest.shiftDate.toISOString())

    // Manually re-calculate logic
    const checkInAt = latest.checkInAt!
    const shiftDate = latest.shiftDate
    const userCheckInTime = latest.user.checkInTime || '21:00'

    console.log('--- Manual Recalc ---')
    console.log('  Using CheckInTime:', userCheckInTime)
    console.log('  Using LateThreshold:', process.env.LATE_THRESHOLD_MINUTES || '10 (default)')

    const year = shiftDate.getFullYear()
    const month = String(shiftDate.getMonth() + 1).padStart(2, '0')
    const day = String(shiftDate.getDate()).padStart(2, '0')
    const offset = '+05:00'

    const scheduledIsoString = `${year}-${month}-${day}T${userCheckInTime}:00${offset}`
    const deadlineBase = new Date(scheduledIsoString)
    // add threshold
    const threshold = parseInt(process.env.LATE_THRESHOLD_MINUTES || '10')
    deadlineBase.setMinutes(deadlineBase.getMinutes() + threshold)

    console.log('  Constructed Deadline (ISO):', deadlineBase.toISOString())
    console.log('  CheckInAt (ISO):', checkInAt.toISOString())

    if (checkInAt > deadlineBase) {
        console.log('  Result: LATE (CheckIn > Deadline)')
    } else {
        console.log('  Result: ON_TIME (CheckIn <= Deadline)')
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
