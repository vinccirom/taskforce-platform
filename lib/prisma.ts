import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const directUrl = process.env.DIRECT_DATABASE_URL

  if (directUrl) {
    // Direct PostgreSQL connection via driver adapter
    const { PrismaPg } = require('@prisma/adapter-pg')
    const pg = require('pg')
    const pool = new pg.Pool({ connectionString: directUrl })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ log: ['error'], adapter })
  }

  const accelerateUrl = process.env.DATABASE_URL
  if (accelerateUrl) {
    return new PrismaClient({
      log: ['error'],
    })
  }

  throw new Error('No database URL configured. Set DIRECT_DATABASE_URL or DATABASE_URL.')
}

// Lazy singleton — don't create client at import time (breaks Vercel build)
let _prisma: PrismaClient | undefined

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      _prisma = globalForPrisma.prisma ?? createPrismaClient()
      if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _prisma
    }
    return (_prisma as any)[prop]
  }
})
