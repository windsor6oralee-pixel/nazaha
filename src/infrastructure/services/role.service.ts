import type { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/client";

export const SYSTEM_ROLES = [
  { name: "admin",      nameAr: "مدير النظام" },
  { name: "hr_manager", nameAr: "مدير الموارد البشرية" },
  { name: "hr_officer", nameAr: "موظف الموارد البشرية" },
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[number]["name"];
type Client = Prisma.TransactionClient | typeof prisma;

// Idempotent: every tenant gets the three system roles. Accepts a transaction client so
// tenant provisioning can include it atomically.
export async function ensureSystemRoles(organizationId: string, db: Client = prisma) {
  const roles = [];
  for (const r of SYSTEM_ROLES) {
    roles.push(
      await db.role.upsert({
        where: { organizationId_name: { organizationId, name: r.name } },
        update: { isSystem: true, nameAr: r.nameAr },
        create: { organizationId, name: r.name, nameAr: r.nameAr, isSystem: true },
      })
    );
  }
  return Object.fromEntries(roles.map((r) => [r.name, r])) as Record<SystemRoleName, (typeof roles)[number]>;
}
