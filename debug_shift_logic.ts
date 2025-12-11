
import { getShiftDate } from './lib/attendance'

// Mock environment
process.env.DEFAULT_TIMEZONE = 'Asia/Karachi'

function test() {
    console.log('--- DEBUG SHIFT LOGIC ---')
    const now = new Date('2025-12-11T15:59:12+05:00') // Talha's checkin time
    console.log('Now:', now.toString())
    console.log('Now ISO:', now.toISOString())

    const checkInTime = "15:59"
    const checkOutTime = "16:05"

    console.log(`Inputs: CheckIn=${checkInTime}, CheckOut=${checkOutTime}`)

    const shiftDate = getShiftDate(now, checkInTime, checkOutTime)

    console.log('Calculated Shift Date:', shiftDate.toString())
    console.log('Calculated Shift Date ISO:', shiftDate.toISOString())

    // Check if it's Dec 10 or Dec 11
    if (shiftDate.getDate() === 10) {
        console.error('FAIL: Calculated date is Dec 10 (Yesterday)!')
    } else if (shiftDate.getDate() === 11) {
        console.log('SUCCESS: Calculated date is Dec 11 (Today)')
    } else {
        console.log('UNKNOWN DATE:', shiftDate.getDate())
    }
}

test()
