
import { getAttendanceStatus, getShiftDate } from './lib/attendance'

// Mock Env
process.env.DEFAULT_TIMEZONE = 'Asia/Karachi'
process.env.LATE_THRESHOLD_MINUTES = '10'

function runScenario(name: string, shiftTime: string, checkInIso: string) {
    console.log(`\n--- SCENARIO: ${name} ---`)
    console.log(`Shift Schedule: ${shiftTime} - 05:00`)

    // 1. Setup CheckIn Time (PKT)
    // We construct it carefully to ensure it represents the intended local time
    // checkInIso should be like "2025-12-12T00:05:00+05:00"
    const checkInAt = new Date(checkInIso)
    console.log(`Actual CheckIn: ${checkInAt.toString()} (${checkInIso})`)

    // 2. Get Shift Date
    const userCheckIn = shiftTime
    const userCheckOut = "05:00"

    // Simulate getShiftDate logic (importing current code)
    const shiftDate = getShiftDate(checkInAt, userCheckIn, userCheckOut)

    // 3. Status
    const status = getAttendanceStatus(checkInAt, shiftDate, userCheckIn)

    console.log(`Calculated Shift Date: ${shiftDate.toISOString()}`)
    console.log(`RESULT: ${status}`)
}

console.log('--- DEBUG OVERNIGHT ---')

// Case 1: 11:00 PM Shift. Check In 11:05 PM (Same Day).
// Expect: ON_TIME
runScenario(
    "11pm Shift - 11:05pm CheckIn",
    "23:00",
    "2025-12-12T23:05:00+05:00"
)

// Case 2: 11:00 PM Shift. Check In 00:05 AM (Next Day). 
// 1 hour 5 mins late.
// Expect: ON_TIME? NO. They are 1 hour late.
// Expect: LATE.
runScenario(
    "11pm Shift - 00:05am CheckIn",
    "23:00",
    "2025-12-13T00:05:00+05:00"
)

// Case 3: 11:00 PM Shift. Check In 11:15 PM (15 mins late).
// Threshold 10 mins.
// Expect: LATE.
runScenario(
    "11pm Shift - 11:15pm CheckIn",
    "23:00",
    "2025-12-12T23:15:00+05:00"
)

// Case 4: 12:00 AM (Midnight) Shift. Check In 00:05 AM.
// Expect: ON_TIME.
runScenario(
    "Midnight Shift - 00:05am CheckIn",
    "00:00",
    "2025-12-13T00:05:00+05:00"
)

// Case 5: 9:00 PM Shift. Check In 12:05 AM (Next Day).
// 3 hours late.
// Expect: LATE.
runScenario(
    "9pm Shift - 00:05am CheckIn",
    "21:00",
    "2025-12-13T00:05:00+05:00"
)
