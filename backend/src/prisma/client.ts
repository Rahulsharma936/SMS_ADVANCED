import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// P2A: Environment-aware logging — disable expensive query logging in production
const logConfig = process.env.NODE_ENV === 'production'
  ? ['warn', 'error'] as const
  : ['query', 'info', 'warn', 'error'] as const;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [...logConfig],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
