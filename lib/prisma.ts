import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const directUrl = process.env.DIRECT_DATABASE_URL

  if (directUrl) {
    // Direct PostgreSQL connection — fast, reliable, no flaky proxy
    const pool = new pg.Pool({ connectionString: directUrl })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ log: ['error'], adapter })
  }

  // Fallback to Prisma Accelerate proxy
  return new PrismaClient({
    log: ['error'],
    accelerateUrl: process.env.DATABASE_URL,
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
