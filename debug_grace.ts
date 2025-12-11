
import { getAttendanceStatus, getShiftDate } from './lib/attendance'

// Mock Env
process.env.DEFAULT_TIMEZONE = 'Asia/Karachi'
process.env.LATE_THRESHOLD_MINUTES = '10'

// Scenario:
// Scheduled: 12:12
// Actual: 12:20
// Expectation: ON_TIME (since 12:20 < 12:22)

function testGrace() {
    console.log('--- DEBUG GRACE PERIOD ---')

    // 1. Setup Dates
    // We need "Today" at 12:20 PKT.
    // 12:20 PKT = 07:20 UTC (if standard time)
    // Let's rely on string construction to be safe on Vercel
    const checkInAt = new Date('2025-12-12T07:20:00Z') // 12:20 PM PKT
    console.log('CheckIn At (UTC):', checkInAt.toISOString())
    console.log('CheckIn At (Local):', checkInAt.toString())

    // 2. Scheduled Time Setup
    const userCheckIn = "12:12"
    const userCheckOut = "20:00"

    // 3. Shift Date Calculation
    const shiftDate = getShiftDate(checkInAt, userCheckIn, userCheckOut)
    console.log('Shift Date:', shiftDate.toISOString())

    // 4. Get Status
    // We need to verify what lib/attendance reads as threshold
    // Since we mocked process.env, it should be 10.

    const status = getAttendanceStatus(checkInAt, shiftDate, userCheckIn)
    console.log('RESULT STATUS:', status)

    if (status === 'LATE') {
        console.error('FAIL: Status is LATE. Logic is flawed.')
    } else {
        console.log('SUCCESS: Status is ON_TIME.')
    }
}

testGrace()
