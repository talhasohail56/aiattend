import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev'

export async function sendCheckInEmail(
    userEmail: string,
    userName: string,
    time: string,
    status: string
) {
    if (!resend) {
        console.warn('RESEND_API_KEY is missing. Skipping email.')
        return null
    }

    try {
        const { data, error } = await resend.emails.send({
            from: `Attendance System <${FROM_EMAIL}>`,
            to: [userEmail],
            subject: `Check-in Confirmation - ${status}`,
            html: `
        <h1>Check-in Confirmed</h1>
        <p>Hi ${userName},</p>
        <p>You have successfully checked in at <strong>${time}</strong>.</p>
        <p>Status: <strong>${status}</strong></p>
        <br>
        <p>Have a great shift!</p>
      `,
        })

        if (error) {
            console.error('Email error:', error)
            return null
        }

        return data
    } catch (err) {
        console.error('Email exception:', err)
        return null
    }
}

export async function sendCheckOutEmail(
    userEmail: string,
    userName: string,
    time: string,
    duration?: string
) {
    if (!resend) {
        console.warn('RESEND_API_KEY is missing. Skipping email.')
        return null
    }

    try {
        const { data, error } = await resend.emails.send({
            from: `Attendance System <${FROM_EMAIL}>`,
            to: [userEmail],
            subject: 'Check-out Confirmation',
            html: `
        <h1>Check-out Confirmed</h1>
        <p>Hi ${userName},</p>
        <p>You have successfully checked out at <strong>${time}</strong>.</p>
        ${duration ? `<p>Shift Duration: <strong>${duration}</strong></p>` : ''}
        <br>
        <p>Rest well!</p>
      `,
        })

        if (error) {
            console.error('Email error:', error)
            return null
        }

        return data
    } catch (err) {
        console.error('Email exception:', err)
        return null
    }
}

export async function sendLateNotificationEmail(
    adminEmail: string,
    employeeName: string,
    time: string,
    status: string
) {
    if (!resend) {
        return null
    }

    try {
        const { data, error } = await resend.emails.send({
            from: `Attendance System <${FROM_EMAIL}>`,
            to: [adminEmail],
            subject: `LATE ALERT: ${employeeName}`,
            html: `
        <h1>Late Check-in Alert</h1>
        <p>Employee <strong>${employeeName}</strong> has checked in <strong>${status}</strong>.</p>
        <p>Check-in Time: <strong>${time}</strong></p>
        <br>
        <p>Please review depending on your policy.</p>
      `,
        })

        if (error) {
            console.error('Email error:', error)
            return null
        }

        return data
    } catch (err) {
        console.error('Email exception:', err)
        return null
    }
}
