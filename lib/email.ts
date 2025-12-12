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

export async function sendWelcomeEmail(
    email: string,
    name: string,
    password: string
) {
    if (!resend) {
        console.warn('RESEND_API_KEY is missing. Skipping welcome email.')
        return null
    }

    try {
        const { data, error } = await resend.emails.send({
            from: `Attendance System <${FROM_EMAIL}>`,
            to: [email],
            subject: 'Welcome to Attendance System - Your Credentials',
            html: `
        <h1>Welcome, ${name}!</h1>
        <p>Your account has been created.</p>
        <p>Here are your login credentials:</p>
        <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Password:</strong> ${password}</li>
        </ul>
        <br>
        <p>Please login and change your password if needed.</p>
        <a href="${process.env.NEXTAUTH_URL || 'https://aiattend.vercel.app'}/login">Login Here</a>
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

export async function sendLateRequestEmail(
    adminEmail: string,
    employeeName: string,
    shiftDate: string,
    time: string,
    reason: string,
    approveLink: string,
    rejectLink: string
) {
    if (!resend) {
        return null
    }

    try {
        const { data, error } = await resend.emails.send({
            from: `Attendance System <${FROM_EMAIL}>`,
            to: [adminEmail],
            subject: `LATE REQUEST: ${employeeName} for ${shiftDate}`,
            html: `
        <h1>Late Arrival Request</h1>
        <p><strong>Employee:</strong> ${employeeName}</p>
        <p><strong>Date:</strong> ${shiftDate}</p>
        <p><strong>Requested Time:</strong> ${time}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <br>
        <p>Please click one of the buttons below to approve or reject this request.</p>
        <br>
        <div style="display: flex; gap: 20px;">
            <a href="${approveLink}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Request</a>
            <a href="${rejectLink}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject Request</a>
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
            Accepting will automatically update the schedule for this day.
        </p>
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


// Gmail Transporter for Employee Notifications (Free Tier Bypass)
import nodemailer from 'nodemailer'

const gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
})

export async function sendLateRequestDecisionEmail(
    employeeEmail: string,
    employeeName: string,
    shiftDate: string,
    status: 'APPROVED' | 'REJECTED',
    reason?: string
) {
    // We use Gmail here because Resend Free Tier forbids sending to unverified emails (employees)
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn('GMAIL credentials missing. Skipping decision email.')
        return null
    }

    const isApproved = status === 'APPROVED'
    const color = isApproved ? '#10b981' : '#ef4444' // Green or Red
    const title = isApproved ? 'Late Request Approved' : 'Late Request Rejected'

    try {
        const info = await gmailTransporter.sendMail({
            from: `"Attendance Admin" <${process.env.GMAIL_USER}>`,
            to: employeeEmail,
            subject: `Request Update: ${title}`,
            html: `
        <h1 style="color: ${color};">${title}</h1>
        <p>Hi ${employeeName},</p>
        <p>Your request for late arrival on <strong>${shiftDate}</strong> has been <strong>${status}</strong>.</p>
        ${isApproved
                    ? `<p>Your schedule has been updated accordingly.</p>`
                    : `<p>Please contact the admin if you have questions.</p>`
                }
        <br>
        <p>Best,<br>Attendance Admin</p>
      `,
        })

        return info
    } catch (err) {
        console.error('Gmail send error:', err)
        return null
    }
}
