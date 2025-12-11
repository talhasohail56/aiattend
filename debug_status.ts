
import { getAttendanceStatus, getShiftDate } from './lib/attendance'

// Mock Env
process.env.DEFAULT_TIMEZONE = 'Asia/Karachi'
const LATE_THRESHOLD_MINUTES = 15

// Simulate Vercel UTC Environment
// 11:26 PM PKT = 18:26 UTC.
// Scheduled: 23:00 PKT = 18:00 UTC.

function testStatus() {
    console.log('--- DEBUG STATUS LOGIC ---')

    // 1. Current Time (CheckInAt)
    const checkInAt = new Date('2025-12-11T18:26:00Z') // 11:26 PM PKT
    console.log('CheckIn At (UTC):', checkInAt.toISOString())
    console.log('CheckIn At (Local):', checkInAt.toString())

    // 2. Scheduled Time Setup
    const userCheckIn = "23:00"
    const userCheckOut = "05:00"

    // 3. Shift Date Calculation
    // Use the existing function
    const shiftDate = getShiftDate(checkInAt, userCheckIn, userCheckOut)
    console.log('Shift Date (from lib):', shiftDate.toISOString())

    // 4. Get Status
    const status = getAttendanceStatus(checkInAt, shiftDate, userCheckIn)
    console.log('RESULT STATUS:', status)

    if (status === 'EARLY') {
        console.error('FAIL: Status is EARLY (Should be LATE or ON_TIME depending on threshold)')
    } else {
        console.log('SUCCESS: Status seems reasonable:', status)
    }
}

testStatus()
