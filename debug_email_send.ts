
import { sendWelcomeEmail } from '@/lib/email'

// Helper to test if email sends
async function testEmail() {
    console.log('--- EMAIL TEST START ---')
    const key = process.env.RESEND_API_KEY
    console.log('API Key Present:', !!key) // Don't log key itself
    if (key && key.length > 5) {
        console.log('API Key Prefix:', key.substring(0, 4) + '...')
    }

    // Use a temp email or safe target? Or the user's own email?
    // I can't know the user's email easily. 
    // I'll try sending to a dummy address and inspect the Resend result object.
    // Resend dev mode only allows sending to the registered team email usually.
    // If successful, Resend returns an ID.

    // Attempt to send to 'test@example.com' - Resend might block this if not verified domain.
    // But Resend 'onboarding' usually allows to 'delivered@resend.dev' or myself.

    // Let's rely on the function's output.
    const result = await sendWelcomeEmail('test@test.com', 'Test User', '123456')
    console.log('Result:', result)

    if (result && result.id) {
        console.log('SUCCESS: Email ID received.')
    } else {
        console.log('FAIL: No ID received.')
    }
}

testEmail().catch(console.error)
