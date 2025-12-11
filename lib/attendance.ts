import { AttendanceStatus } from '@prisma/client'

export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Karachi'
export const CHECK_IN_TIME = process.env.CHECK_IN_TIME || '21:00'
export const CHECK_OUT_TIME = process.env.CHECK_OUT_TIME || '05:00'
export const LATE_THRESHOLD_MINUTES = parseInt(process.env.LATE_THRESHOLD_MINUTES || '10')

/**
 * Get check-in time for a user (uses user-specific or default)
 */
export function getUserCheckInTime(userCheckInTime: string | null | undefined): string {
  return userCheckInTime || CHECK_IN_TIME
}

/**
 * Get check-out time for a user (uses user-specific or default)
 */
export function getUserCheckOutTime(userCheckOutTime: string | null | undefined): string {
  return userCheckOutTime || CHECK_OUT_TIME
}

/**
 * Get hour/minute in the configured timezone
 */
export function getPartsInTimezone(date: Date): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0')
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0')
  return { hour: hour === 24 ? 0 : hour, minute }
}

/**
 * Get the shift date for a given timestamp
 * A shift starts at check-in time and ends at check-out time next day
 * The shiftDate is the date of the check-in time (start of shift)
 */
export function getShiftDate(
  date: Date = new Date(),
  userCheckInTime?: string | null,
  userCheckOutTime?: string | null
): Date {
  const checkInTime = getUserCheckInTime(userCheckInTime)
  const checkOutTime = getUserCheckOutTime(userCheckOutTime)
  const [checkInHours, checkInMinutes] = checkInTime.split(':').map(Number)
  const [checkOutHours, checkOutMinutes] = checkOutTime.split(':').map(Number)

  // 1. Get Current 'Wall Clock' Time in Target Timezone (PKT)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: 'numeric', // 1-12
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })

  // Format parts to reliable object
  const parts = formatter.formatToParts(date)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0'

  let currentYear = parseInt(getPart('year'))
  let currentMonth = parseInt(getPart('month')) // 1-12
  let currentDay = parseInt(getPart('day'))
  const currentHour = parseInt(getPart('hour') === '24' ? '0' : getPart('hour'))
  const currentMinute = parseInt(getPart('minute'))

  // 2. Determine Logic based on 'Wall Clock' time
  const isOvernight = checkInHours > checkOutHours || (checkInHours === checkOutHours && checkInMinutes > checkOutMinutes)

  let shiftYear = currentYear
  let shiftMonth = currentMonth
  let shiftDay = currentDay

  if (isOvernight) {
    if (currentHour < checkOutHours || (currentHour === checkOutHours && currentMinute < checkOutMinutes)) {
      // It's early morning (e.g. 2am), but belongs to previous night's shift
      // Subtract 1 day from the current PKT date
      // We can use a Date object to handle month/year rollover easily
      // Create a date at Noon (avoid DST issues) in local, subtract day, read back components
      // Actually strictly:
      const d = new Date(currentYear, currentMonth - 1, currentDay) // Month is 0-indexed
      d.setDate(d.getDate() - 1)
      shiftYear = d.getFullYear()
      shiftMonth = d.getMonth() + 1
      shiftDay = d.getDate()
    }
  }

  // 3. Construct Absolute Timestamp for the Shift Start
  // Format: YYYY-MM-DDTHH:mm:00+05:00
  const yyyy = shiftYear
  const mm = String(shiftMonth).padStart(2, '0')
  const dd = String(shiftDay).padStart(2, '0')
  const hh = String(checkInHours).padStart(2, '0')
  const min = String(checkInMinutes).padStart(2, '0')

  // Hardcoded offset for robustness (env var DEFAULT_TIMEZONE is Asia/Karachi)
  const offset = '+05:00'

  const isoString = `${yyyy}-${mm}-${dd}T${hh}:${min}:00${offset}`
  return new Date(isoString)
}

/**
 * Helper to construct a proper Date object for the Shift Start in the Target Timezone
 */
export function getShiftStartTimestamp(shiftDateNaive: Date, checkInTimeStr: string): Date {
  // shiftDateNaive is the Date object from getShiftDate.
  // We care about its YYYY-MM-DD parts relative to the Timezone? 
  // ACTUALLY: getShiftDate returns a Date object where .getDate() matches the shift day.
  // But .getHours() matches the checkIn time (in Vercel's Zone).

  // We want to construct "YYYY-MM-DD" (from shiftDate) + "HH:mm" (from checkInTime) + "DEFAULT_TIMEZONE Offset".
  // Since calculating offset manually is hard without libraries...
  // We can use a different trick: Use the String representation.

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  })
  const parts = formatter.formatToParts(shiftDateNaive)
  // This formats shiftDateNaive using PKT. 
  // If shiftDateNaive was set using setHours(23) in UTC... converting to PKT adds 5 hours -> Next Day 04:00.
  // FAIL.

  // STRATEGY: 
  // getShiftDate should return the Date where Date-Part is correct.
  // In Route, we will parse this Date-Part, Combine with Time-Part, and Force Timezone.
  return shiftDateNaive
}

/**
 * Get check-in deadline (check-in time + late threshold)
 */
/**
 * Get check-in deadline (check-in time + late threshold)
 */
export function getCheckInDeadline(
  shiftDate: Date,
  userCheckInTime?: string | null
): Date {
  // shiftDate is already the exact Shift Start Timestamp (in correct TZ) from getShiftDate
  // We just need to add the threshold minutes.
  const deadline = new Date(shiftDate)
  deadline.setMinutes(deadline.getMinutes() + LATE_THRESHOLD_MINUTES)
  return deadline
}

/**
 * Determine attendance status based on check-in time
 */
export function getAttendanceStatus(
  checkInAt: Date | null,
  shiftDate: Date,
  userCheckInTime?: string | null
): AttendanceStatus {
  if (!checkInAt) {
    return AttendanceStatus.ABSENT
  }

  const deadline = getCheckInDeadline(shiftDate, userCheckInTime)
  const scheduledTime = new Date(deadline)
  scheduledTime.setMinutes(scheduledTime.getMinutes() - LATE_THRESHOLD_MINUTES)

  // Calculate difference in minutes
  // positive = scheduled is future (early)
  // negative = scheduled is past (late)
  const diffMinutes = (scheduledTime.getTime() - checkInAt.getTime()) / (1000 * 60)

  // Debug log
  console.log('Status Debug:', {
    checkInAt: checkInAt.toISOString(),
    scheduledTime: scheduledTime.toISOString(),
    deadline: deadline.toISOString(),
    threshold: LATE_THRESHOLD_MINUTES,
    diffMinutes
  })

  // If check-in is more than 2 hours (120 mins) before scheduled time
  if (diffMinutes > 120) {
    return AttendanceStatus.EARLY
  }

  if (checkInAt > deadline) {
    return AttendanceStatus.LATE
  }

  return AttendanceStatus.ON_TIME
}

/**
 * Format date for display
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date)
}

/**
 * Format time for display
 */
export function formatTime(date: Date | null | undefined): string {
  if (!date) return 'N/A'
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date)
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return 'N/A'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date)
}

