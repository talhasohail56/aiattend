
import { PrismaClient } from '@prisma/client'
import { getShiftDate } from './lib/attendance'
import { NextRequest } from 'next/server'

// Mock environment
process.env.CHECK_IN_TIME = '21:00'

// Replicating route logic entirely
function testRouteLogic() {
    console.log('--- TEST ROUTE LOGIC ---')

    // Simulating Talha's situation:
    // Scheduled: 21:00
    // Attempt: 15:59 (Same day) -> 5 hours early.

    const checkInTimeStr = '21:00'
    const now = new Date('2025-12-11T15:59:00+05:00')

    console.log('Now:', now.toISOString())

    // 1. Shift Date Calculation
    // We assume getShiftDate returns TODAY for this case (based on previous fixes)
    const shiftDate = new Date('2025-12-11T21:00:00+05:00') // Hardcoded "Correct" shift date base
    shiftDate.setHours(21, 0, 0, 0)

    console.log('Shift Date Base:', shiftDate.toISOString())

    // 2. Scheduled Check In Construction
    const [scheduledHours, scheduledMinutes] = checkInTimeStr.split(':').map(Number)

    const scheduledCheckIn = new Date(shiftDate)
    scheduledCheckIn.setHours(scheduledHours, scheduledMinutes, 0, 0)

    console.log('Scheduled Check In:', scheduledCheckIn.toISOString())
    // Should be 2025-12-11T16:00:00Z (21:00 PKT)

    // 3. Diff Calculation
    const diffMs = scheduledCheckIn.getTime() - now.getTime()
    const diffMinutes = diffMs / (1000 * 60)

    console.log('Diff Minutes:', diffMinutes)

    if (diffMinutes > 60) {
        console.log('RESULT: BLOCKED (Too early)')
    } else {
        console.log('RESULT: ALLOWED')
    }
}

testRouteLogic()
