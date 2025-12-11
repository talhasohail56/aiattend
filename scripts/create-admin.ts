/**
 * Script to create an admin user
 * Run with: npx tsx scripts/create-admin.ts
 */

import { prisma } from '../lib/db'
import { hashPassword } from '../lib/auth'
import { UserRole } from '@prisma/client'

async function createAdmin() {
  const args = process.argv.slice(2)
  
  if (args.length < 3) {
    console.log('Usage: npx tsx scripts/create-admin.ts <name> <email> <password>')
    process.exit(1)
  }

  const [name, email, password] = args

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      console.error('User with this email already exists')
      process.exit(1)
    }

    // Create admin user
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: UserRole.ADMIN,
      },
    })

    console.log('Admin user created successfully!')
    console.log(`Name: ${user.name}`)
    console.log(`Email: ${user.email}`)
    console.log(`Role: ${user.role}`)
  } catch (error) {
    console.error('Error creating admin user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()


