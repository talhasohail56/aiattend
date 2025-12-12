const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const userId = 'cmj1tcffx0000ejd1alxqvqgo' // Musaab
    const todayStr = '2025-12-12'

    console.log('--- DB Content Debug ---')
    // Check overrides
    const overrides = await prisma.shiftOverride.findMany({
        where: { userId }
    })
    console.log('Overrides found:', overrides.length)
    overrides.forEach(o => {
        console.log(`Override Date: ${o.shiftDate.toISOString()} (Local: ${o.shiftDate.toString()})`)
        console.log(`New Time: ${o.newCheckInTime}`)
    })

    // Simulate Check-in Calc
    const { getShiftDate } = require('./lib/attendance') // We can't require TS? 
    // Okay, manual simulation of logic
    // Assume generic checkin logic produces:
    const checkInCalc = new Date('2025-12-12T22:00:00+05:00')
    console.log(`\nCheck-in Route searches for: ${checkInCalc.toISOString()}`)

    // Compare
    const matched = overrides.find(o => o.shiftDate.getTime() === checkInCalc.getTime())
    if (matched) {
        console.log('MATCH FOUND!')
    } else {
        console.log('NO MATCH. This is the bug.')
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
