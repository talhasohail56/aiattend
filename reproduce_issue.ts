
import { getAttendanceStatus, getShiftDate } from './lib/attendance'
import { AttendanceStatus } from '@prisma/client'

// Mock environment
process.env.CHECK_IN_TIME = '21:00'
process.env.CHECK_OUT_TIME = '05:00'
process.env.LATE_THRESHOLD_MINUTES = '15'
process.env.DEFAULT_TIMEZONE = 'Asia/Karachi'

function testCheckIn(timeStr: string, description: string) {
    // Construct check-in time today at the given time
    const [hours, minutes] = timeStr.split(':').map(Number)
    const checkInAt = new Date()
    checkInAt.setHours(hours, minutes, 0, 0)

    // Calculate shift date for this check-in
    // We assume the user is checking in "now" (which is the mock checkInAt)
    const shiftDate = getShiftDate(checkInAt)

    const status = getAttendanceStatus(checkInAt, shiftDate)

    console.log(`\nTest: ${description}`)
    console.log(`Check In Time: ${timeStr}`)
    console.log(`Shift Date: ${shiftDate.toLocaleString()}`)
    console.log(`Status: ${status}`)

    return status
}

console.log('--- STARTING REPRODUCTION ---')
console.log(`System Time: ${new Date().toLocaleString()}`)

console.log('--- STARTING REPRODUCTION ---')
console.log(`System Time: ${new Date().toLocaleString()}`)

// Hypothesis 3: Same Day Shift Bug
// Schedule: 21:00 - 23:00 (9 PM to 11 PM same day)
process.env.CHECK_IN_TIME = '21:00'
process.env.CHECK_OUT_TIME = '23:00'
testCheckIn('21:00', 'Same Day Shift (21-23), Checking in at 21:00')

// Reset
process.env.CHECK_IN_TIME = '21:00'
process.env.CHECK_OUT_TIME = '05:00'

console.log('--- END ---')

console.log('--- END ---')
