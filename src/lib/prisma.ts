/**
 * Client Prisma partagé (singleton).
 * En développement, Next.js recharge les modules à chaud : on réutilise
 * l'instance stockée sur `globalThis` pour éviter d'épuiser les connexions.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
