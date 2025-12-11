import { PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from '../lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminEmail = 'talhasohail56@gmail.com'
  const adminPassword = 'talha123'

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (existingAdmin) {
    console.log('Admin user already exists, updating password...')
    const passwordHash = await hashPassword(adminPassword)
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        passwordHash,
        role: UserRole.ADMIN,
      },
    })
    console.log('Admin user updated successfully!')
  } else {
    const passwordHash = await hashPassword(adminPassword)
    const admin = await prisma.user.create({
      data: {
        name: 'Admin',
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
      },
    })
    console.log('Admin user created successfully!')
    console.log(`Email: ${admin.email}`)
    console.log(`Password: ${adminPassword}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


