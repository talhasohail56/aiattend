
import { getShiftDate } from './lib/attendance'

// Simulate Vercel Environment (UTC)
// 11:00 PM PKT is 6:00 PM UTC
// So if user checks in at 11:00 PM PKT, the server sees 18:00 UTC.
// Scheduled time is "23:00" (User profile string).

function testTimezone() {
    console.log('--- DEBUG TIMESTONE ---')

    // "Now" is 18:00 UTC (which is 23:00 PKT)
    const now = new Date('2025-12-11T18:00:00Z')
    console.log('Server Now (UTC):', now.toISOString())
    console.log('Server Now (Local/Vercel):', now.toString())

    // User settings
    const userCheckIn = "23:00"
    const userCheckOut = "05:00"

    const shiftDate = getShiftDate(now, userCheckIn, userCheckOut)
    console.log('Shift Date calculated:', shiftDate.toISOString())

    // Route Logic Replication
    const [scheduledHours, scheduledMinutes] = userCheckIn.split(':').map(Number)

    const scheduledCheckIn = new Date(shiftDate)
    scheduledCheckIn.setHours(scheduledHours, scheduledMinutes, 0, 0)

    console.log('Scheduled CheckIn (Constructed):', scheduledCheckIn.toISOString())

    const diffMs = scheduledCheckIn.getTime() - now.getTime()
    const diffMinutes = diffMs / (1000 * 60)

    console.log('Diff Minutes:', diffMinutes)

    if (diffMinutes > 60) {
        console.error('FAIL: User blocked! System thinks it is too early.')
    } else {
        console.log('SUCCESS: User allowed.')
    }
}

testTimezone()
