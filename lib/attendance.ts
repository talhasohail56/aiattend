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

  // If current time is before check-out time AND it's an overnight shift, the shift belongs to previous day
  const currentHour = d.getHours()
  const currentMinute = d.getMinutes()

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

  d.setHours(checkInHours, checkInMinutes, 0, 0)
  return d
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

