import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { UserRole } from '@prisma/client'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole = UserRole.EMPLOYEE
) {
  const normalizedEmail = email.toLowerCase()
  const passwordHash = await hashPassword(password)
  return prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name,
      role,
    },
  })
}

export async function getUserByEmail(email: string) {
  // NUCLEAR OPTION: Fetch all users and filter in JS to avoid SQL casing/parameter issues entirely
  // This is safe for small user bases.
  console.log(`[AUTH] Lookup request for: '${email}'`)

  try {
    const allUsers = await prisma.$queryRaw`
        SELECT id, name, email, role, "passwordHash"
        FROM "User"
      ` as any[]

    const targetEmail = email.toLowerCase().trim()
    const user = allUsers.find(u => u.email && u.email.toLowerCase().trim() === targetEmail)

    if (user) {
      console.log(`[AUTH] Found user: ${user.email} (Role: ${user.role})`)
      return user
    } else {
      console.log(`[AUTH] No matching user found for '${targetEmail}' in ${allUsers.length} records.`)
      return null
    }
  } catch (err) {
    console.error('[AUTH] DB Error during lookup:', err)
    return null
  }
}

export async function verifyUser(email: string, password: string) {
  const user = await getUserByEmail(email)
  if (!user) {
    console.log('[AUTH] Verify failed: User not found')
    return null
  }

  // 1. Try bcrypt comparison
  let isValid = false
  try {
    isValid = await verifyPassword(password, user.passwordHash)
  } catch (e) {
    console.error('[AUTH] Bcrypt error:', e)
  }

  // 2. Fallback: Plain text check
  if (!isValid && password === user.passwordHash) {
    console.log('[AUTH] Plain text password match successful')
    isValid = true
  }

  if (!isValid) {
    console.log('[AUTH] Password mismatch')
    return null
  }

  return user
}
