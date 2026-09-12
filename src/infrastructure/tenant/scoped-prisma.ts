import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/client";

type Where = Record<string, unknown>;
type Args = { where?: Where; data?: Where | Where[]; create?: Where } & Record<string, unknown>;
type Op = { operation: string; args: Args; query: (args: Args) => Promise<unknown> };

const WHERE_OPS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "findUnique", "findUniqueOrThrow",
  "update", "updateMany", "delete", "deleteMany", "count", "aggregate", "groupBy", "upsert",
]);

// Tracks whether we are already inside a tenant transaction whose connection has
// app.current_org set; nested operations must then run on that same connection.
const txContext = new AsyncLocalStorage<{ organizationId: string }>();

const SET_ORG = (organizationId: string) =>
  Prisma.sql`SELECT set_config('app.current_org', ${organizationId}, TRUE)`;

function withScope(where: Where | undefined, scope: Where): Where {
  const existing = where ?? {};
  const and = Array.isArray(existing.AND) ? existing.AND : existing.AND ? [existing.AND] : [];
  return { ...existing, AND: [...and, scope] };
}

function injectOrg(data: Where, organizationId: string): Where {
  if (data.organization) {
    return { ...data, organization: { connect: { id: organizationId } } };
  }
  return { ...data, organizationId };
}

// Layer 1 (application): inject the tenant filter into every query.
// Layer 2 (database):    run the query in a transaction that first sets app.current_org,
//                        so PostgreSQL RLS policies apply even if layer 1 is bypassed.
async function runScoped(organizationId: string, a: Args, query: Op["query"]) {
  if (txContext.getStore()?.organizationId === organizationId) return query(a);
  const [, result] = await prisma.$transaction([
    prisma.$executeRaw(SET_ORG(organizationId)),
    query(a) as unknown as Prisma.PrismaPromise<unknown>,
  ]);
  return result;
}

function direct(organizationId: string) {
  const scope = { organizationId };
  return {
    async $allOperations({ operation, args, query }: Op) {
      const a: Args = { ...(args ?? {}) };
      if (WHERE_OPS.has(operation)) a.where = withScope(a.where, scope);
      if (operation === "create" && a.data && !Array.isArray(a.data)) a.data = injectOrg(a.data, organizationId);
      if (operation === "upsert" && a.create) a.create = injectOrg(a.create, organizationId);
      if (operation === "createMany" && a.data) {
        a.data = Array.isArray(a.data)
          ? a.data.map((d) => injectOrg(d, organizationId))
          : injectOrg(a.data, organizationId);
      }
      return runScoped(organizationId, a, query);
    },
  };
}

// Relation-scoped models: reads are filtered here, and RLS WITH CHECK blocks any
// create that would attach to a parent outside the tenant.
function viaRelation(organizationId: string, scope: Where) {
  return {
    async $allOperations({ operation, args, query }: Op) {
      const a: Args = { ...(args ?? {}) };
      if (WHERE_OPS.has(operation)) a.where = withScope(a.where, scope);
      return runScoped(organizationId, a, query);
    },
  };
}

export function tenantPrisma(organizationId: string) {
  const viaApp = { application: { organizationId } };
  const viaCandidate = { candidate: { organizationId } };
  const viaWorkflow = { workflow: { organizationId } };
  const actorInOrg = {
    OR: [
      { application: { organizationId } },
      { user: { organizationId } },
      { candidate: { organizationId } },
    ],
  };
  const rel = (scope: Where) => viaRelation(organizationId, scope);

  return prisma.$extends({
    name: `tenant:${organizationId}`,
    query: {
      organization:             rel({ id: organizationId }),
      user:                     direct(organizationId),
      candidate:                direct(organizationId),
      application:              direct(organizationId),
      workflow:                 direct(organizationId),
      systemSetting:            direct(organizationId),
      contract:                 direct(organizationId),
      contractTemplate:         direct(organizationId),
      candidateFieldDefinition: direct(organizationId),
      role:                     direct(organizationId),

      candidateFieldValue:  rel(viaCandidate),
      document:             rel(viaApp),
      onboardingProcess:    rel(viaApp),
      preboardingChannel:   rel(viaApp),
      verificationToken:    rel(viaCandidate),
      workflowStep:         rel(viaWorkflow),
      workflowStepDocument: rel({ workflowStep: viaWorkflow }),
      onboardingStep:       rel({ onboardingProcess: viaApp }),
      documentReview:       rel({ document: viaApp }),
      signature:            rel({ contract: { organizationId } }),
      preboardingMessage:   rel({ channel: viaApp }),
      auditLog:             rel(actorInOrg),
      notification:         rel({ OR: [{ user: { organizationId } }, { candidate: { organizationId } }] }),
    },
  });
}

export type TenantPrisma = ReturnType<typeof tenantPrisma>;
type TxFn = Extract<Parameters<TenantPrisma["$transaction"]>[0], (tx: never) => unknown>;
export type TenantTx = Parameters<TxFn>[0];

// Interactive transaction with the tenant set once on the connection. Every operation
// inside runs on that same connection, so RLS sees app.current_org for all of them.
export function withTenantTransaction<T>(
  db: TenantPrisma,
  organizationId: string,
  fn: (tx: TenantTx) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(SET_ORG(organizationId));
    return txContext.run({ organizationId }, () => fn(tx));
  });
}
