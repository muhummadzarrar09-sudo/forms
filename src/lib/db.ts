import { PrismaClient } from '@prisma/client'

// Always create a fresh Prisma client to pick up schema changes
export const db = new PrismaClient({
  log: ['query'],
})