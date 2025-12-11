import { AttendanceStatus } from '@prisma/client'

export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Karachi'
export const CHECK_IN_TIME = process.env.CHECK_IN_TIME || '21:00'
export const CHECK_OUT_TIME = process.env.CHECK_OUT_TIME || '05:00'
export const LATE_THRESHOLD_MINUTES = parseInt(process.env.LATE_THRESHOLD_MINUTES || '15')

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
  const d = new Date(date)
  const checkInTime = getUserCheckInTime(userCheckInTime)
  const checkOutTime = getUserCheckOutTime(userCheckOutTime)
  const [checkInHours, checkInMinutes] = checkInTime.split(':').map(Number)
  const [checkOutHours, checkOutMinutes] = checkOutTime.split(':').map(Number)

  // Determine if the shift implies an overnight stay (e.g. 21:00 to 05:00)
  // If checkIn < checkOut (e.g. 09:00 to 17:00), it's a same-day shift
  const isOvernight = checkInHours > checkOutHours || (checkInHours === checkOutHours && checkInMinutes > checkOutMinutes)

  // Get current time in TARGET timezone
  const { hour: currentHour, minute: currentMinute } = getPartsInTimezone(d)

  if (isOvernight) {
    if (currentHour < checkOutHours || (currentHour === checkOutHours && currentMinute < checkOutMinutes)) {
      console.log('getShiftDate: Subtracting day', { date: d, checkOutHours, currentHour })
      d.setDate(d.getDate() - 1)
    }
  } else {
    // Debug strict logging to catch anomalies
    // console.log('getShiftDate: Same day shift', { date: d, checkInHours, checkOutHours })
  }
  // For same-day shifts (e.g. 9am start), we assume the shift is on the current day 
  // unless we implement nuanced logic for "very late checkin next day" which is unlikely for same-day shifts.

  // We need to return a Date object that represents the Shift Date ~at~ the Shift Start Time
  // BUT the Date object itself stores a UTC timestamp.
  // Converting "YYYY-MM-DD" + "HH:mm" + "Offset" is best.
  // For now we keep the existing behavior: setHours creates a local date (UTC in Vercel), which might be "Wrong" absolutely but consistent locally.
  // WAIT: If we return "23:00 UTC", but 23:00 PKT is expected...
  // Let's rely on constructing the proper ISO string for the Route handler.

  // Reset H:M:S to shift start time (naive set)
  d.setHours(checkInHours, checkInMinutes, 0, 0)
  return d
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
  const deadline = new Date(shiftDate)
  const checkInTime = getUserCheckInTime(userCheckInTime)
  const [hours, minutes] = checkInTime.split(':').map(Number)
  deadline.setHours(hours, minutes + LATE_THRESHOLD_MINUTES, 0, 0)
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
  const diffMinutes = (scheduledTime.getTime() - checkInAt.getTime()) / (1000 * 60)

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

