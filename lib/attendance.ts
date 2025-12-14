import { AttendanceStatus } from '@prisma/client'

export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Karachi'
export const CHECK_IN_TIME = process.env.CHECK_IN_TIME || '22:00'
export const CHECK_OUT_TIME = process.env.CHECK_OUT_TIME || '06:00'
export const LATE_THRESHOLD_MINUTES = parseInt(process.env.LATE_THRESHOLD_MINUTES || '10')

// PKT offset in milliseconds (+5 hours)
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000

/**
 * Get the current date in PKT timezone as a YYYY-MM-DD string
 */
export function getTodayPKT(): string {
  const now = new Date()
  const pktNow = new Date(now.getTime() + PKT_OFFSET_MS)
  return pktNow.toISOString().split('T')[0] // YYYY-MM-DD
}

/**
 * Get a Date object representing midnight (start of day) in PKT for a given date
 * This ensures consistent date calculations regardless of server timezone
 */
export function startOfDayPKT(date: Date = new Date()): Date {
  // Convert to PKT time
  const pktDate = new Date(date.getTime() + PKT_OFFSET_MS)
  // Get YYYY-MM-DD in PKT
  const dateStr = pktDate.toISOString().split('T')[0]
  // Create midnight in PKT (which is 19:00 UTC previous day)
  // Format: YYYY-MM-DDT00:00:00+05:00
  return new Date(`${dateStr}T00:00:00+05:00`)
}

/**
 * Format a date as YYYY-MM-DD in PKT timezone
 */
export function formatDatePKT(date: Date): string {
  const pktDate = new Date(date.getTime() + PKT_OFFSET_MS)
  return pktDate.toISOString().split('T')[0]
}

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
  // We manually adjust UTC time to PKT (UTC+5) to avoid Intl environment issues.

  const utcDate = new Date(date.getTime())
  const pktDate = new Date(utcDate.getTime() + (5 * 60 * 60 * 1000))

  let currentYear = pktDate.getUTCFullYear()
  let currentMonth = pktDate.getUTCMonth() + 1 // 1-12
  let currentDay = pktDate.getUTCDate()
  let currentHour = pktDate.getUTCHours()
  let currentMinute = pktDate.getUTCMinutes()

  // 2. Determine Logic based on 'Wall Clock' time
  const isOvernight = checkInHours > checkOutHours || (checkInHours === checkOutHours && checkInMinutes > checkOutMinutes)

  let shiftYear = currentYear
  let shiftMonth = currentMonth
  let shiftDay = currentDay

  // Grace period to allow late checkouts (e.g. 5 hours after shift ends)
  // If undefined, default to 5 hours as per request
  const CHECK_OUT_GRACE_HOURS = 5

  if (isOvernight) {
    // Determine if we are technically in the "morning after" the start date.
    // E.g. Shift 22:00 - 05:00. Current is 04:00.
    // We are before the logic "day flip" which happens at midnight? No.
    // We are in the new day physically.

    // If currentHour < checkOutHours (e.g. 4 < 5), we are still completing the previous night's shift.
    // If currentHour >= checkOutHours (e.g. 8 >= 5), we have crossed the shift line.
    // For a NEW check-in, we shouldn't assume it's the old shift if it's past the scheduled end.
    // (Grace period helps for *checkout* but for *checkin* it confuses things).

    // Assume cut-off is strictly the check-out time.
    // Any check-in AFTER check-out time is considered "Early for Next Shift" rather than "Late for Last Shift".

    // BUT: What if someone is 1 hour late for a 05:00 end? check-in 05:30?
    // They are LATE for yesterday.

    // Let's use a smaller buffer for Check-In association. say 2 hours?
    // User was 08:38 (3.5 hours after 05:00).
    // Let's set a "Shift End Buffer" of 2 hours.

    const SHIFT_END_BUFFER_MINUTES = 2 * 60

    const currentTotalMinutes = currentHour * 60 + currentMinute
    const checkOutTotalMinutes = checkOutHours * 60 + checkOutMinutes
    const extendedCutoffMinutes = checkOutTotalMinutes + SHIFT_END_BUFFER_MINUTES

    if (currentTotalMinutes < extendedCutoffMinutes) {
      // It belongs to previous night
      const d = new Date(currentYear, currentMonth - 1, currentDay)
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
export function getCheckInDeadline(
  shiftDate: Date,
  userCheckInTime?: string | null
): Date {
  // shiftDate is already the calculated Start Time of the shift (e.g. 10:00 AM today).
  // We simply need to add the grace period (threshold).

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

