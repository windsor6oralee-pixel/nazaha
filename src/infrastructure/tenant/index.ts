export {
  getTenantContext,
  getPlatformContext,
  requireAuth,
  requireHR,
  requireCandidate,
  requirePlatformAdmin,
  deny,
  type TenantContext,
  type HRContext,
  type CandidateContext,
  type PlatformContext,
} from "./context";
export { tenantPrisma, withTenantTransaction, type TenantPrisma, type TenantTx } from "./scoped-prisma";
