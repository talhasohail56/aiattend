// Minimal reproduction of lib/attendance.ts logic

const DEFAULT_TIMEZONE = 'Asia/Karachi'
const LATE_THRESHOLD_MINUTES = 10
const CHECK_IN_TIME = '22:00'
const CHECK_OUT_TIME = '06:00'

function getShiftDate(date, userCheckInTime, userCheckOutTime) {
    const checkInTime = userCheckInTime || CHECK_IN_TIME
    const checkOutTime = userCheckOutTime || CHECK_OUT_TIME
    const [checkInHours, checkInMinutes] = checkInTime.split(':').map(Number)
    const [checkOutHours, checkOutMinutes] = checkOutTime.split(':').map(Number)

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: DEFAULT_TIMEZONE,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hour12: false,
    })

    const parts = formatter.formatToParts(date)
    const getPart = (type) => parts.find(p => p.type === type)?.value || '0'

    let currentYear = parseInt(getPart('year'))
    let currentMonth = parseInt(getPart('month'))
    let currentDay = parseInt(getPart('day'))
    const currentHour = parseInt(getPart('hour') === '24' ? '0' : getPart('hour'))
    const currentMinute = parseInt(getPart('minute'))

    const isOvernight = checkInHours > checkOutHours || (checkInHours === checkOutHours && checkInMinutes > checkOutMinutes)

    let shiftYear = currentYear
    let shiftMonth = currentMonth
    let shiftDay = currentDay

    if (isOvernight) {
        if (currentHour < checkOutHours || (currentHour === checkOutHours && currentMinute < checkOutMinutes)) {
            const d = new Date(currentYear, currentMonth - 1, currentDay)
            d.setDate(d.getDate() - 1)
            shiftYear = d.getFullYear()
            shiftMonth = d.getMonth() + 1
            shiftDay = d.getDate()
        }
    }

    const yyyy = shiftYear
    const mm = String(shiftMonth).padStart(2, '0')
    const dd = String(shiftDay).padStart(2, '0')
    const hh = String(checkInHours).padStart(2, '0')
    const min = String(checkInMinutes).padStart(2, '0')
    const offset = '+05:00'

    const isoString = `${yyyy}-${mm}-${dd}T${hh}:${min}:00${offset}`
    return new Date(isoString)
}

function getAttendanceStatus(checkInAt, shiftDate, userCheckInTime) {
    const deadline = new Date(shiftDate)
    deadline.setMinutes(deadline.getMinutes() + LATE_THRESHOLD_MINUTES)

    const scheduledTime = new Date(deadline)
    scheduledTime.setMinutes(scheduledTime.getMinutes() - LATE_THRESHOLD_MINUTES)

    const diffMinutes = (scheduledTime.getTime() - checkInAt.getTime()) / (1000 * 60)

    console.log('--- Status Check ---')
    console.log('Now (CheckIn):', checkInAt.toISOString())
    console.log('Shift Start:', shiftDate.toISOString())
    console.log('Deadline:', deadline.toISOString())
    console.log('Diff Minutes:', diffMinutes)

    if (diffMinutes > 120) return 'EARLY'
    if (checkInAt > deadline) return 'LATE'
    return 'ON_TIME'
}

// SIMULATION
const now = new Date() // Use actual system time? No, let's simulate 9:55 PM PKT
// 9:55 PM PKT = 16:55 UTC
// 21:55 PKT
const simulatedNow = new Date('2025-12-12T16:55:00Z')

console.log('Simulating Check-in at 21:55 PKT (for 22:00 Shift)')
const shiftDate = getShiftDate(simulatedNow, '22:00', '06:00')
const status = getAttendanceStatus(simulatedNow, shiftDate, '22:00')
console.log('Result:', status)

console.log('\nSimulating Check-in at 22:05 PKT (On Time Boundary)')
const simulatedNow2 = new Date('2025-12-12T17:05:00Z') // 22:05 PKT
const shiftDate2 = getShiftDate(simulatedNow2, '22:00', '06:00')
const status2 = getAttendanceStatus(simulatedNow2, shiftDate2, '22:00')
console.log('Result:', status2)

console.log('\nSimulating Check-in at 22:15 PKT (Late)')
const simulatedNow3 = new Date('2025-12-12T17:15:00Z') // 22:15 PKT
const shiftDate3 = getShiftDate(simulatedNow3, '22:00', '06:00')
const status3 = getAttendanceStatus(simulatedNow3, shiftDate3, '22:00')
console.log('Result:', status3)
