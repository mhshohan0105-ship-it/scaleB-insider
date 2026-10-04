// Tenant scoped Prisma client (PLAN.md 2.1). Every query on a model that has an
// `agencyId` column is forced into the given agency:
//  * reads/updates/deletes get `agencyId` ANDed into `where`
//  * creates/upserts get `agencyId` written into `data` (overriding any value)
//  * updates can never move a row to another agency
// Services must write foreign keys as scalar ids (roleId, not role: {connect}),
// and must check that referenced ids belong to the tenant (see ownsAll/assertOwned).
// Raw SQL ($queryRaw etc.) is NOT scoped; only report helpers that bind agencyId
// explicitly may use it.
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Model names (PascalCase) that carry an agencyId column. */
export const TENANT_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "agencyId"))
    .map((m) => m.name),
);

type Args = Record<string, unknown>;

function withAgency(where: unknown, agencyId: string): Args {
  return { ...((where as Args | undefined) ?? {}), agencyId };
}

function stripAgency(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const copy = { ...(data as Args) };
  delete copy.agencyId;
  delete copy.agency;
  return copy;
}

function stampAgency(data: unknown, agencyId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => stampAgency(d, agencyId));
  return { ...((stripAgency(data) as Args | undefined) ?? {}), agencyId };
}

export function scopeArgs(operation: string, rawArgs: unknown, agencyId: string): Args {
  const args: Args = { ...((rawArgs as Args | undefined) ?? {}) };
  switch (operation) {
    case "findUnique":
    case "findUniqueOrThrow":
    case "findFirst":
    case "findFirstOrThrow":
    case "findMany":
    case "count":
    case "aggregate":
    case "groupBy":
    case "delete":
    case "deleteMany":
      args.where = withAgency(args.where, agencyId);
      break;
    case "update":
    case "updateMany":
    case "updateManyAndReturn":
      args.where = withAgency(args.where, agencyId);
      args.data = stripAgency(args.data);
      break;
    case "create":
    case "createMany":
    case "createManyAndReturn":
      args.data = stampAgency(args.data, agencyId);
      break;
    case "upsert":
      args.where = withAgency(args.where, agencyId);
      args.create = stampAgency(args.create, agencyId);
      args.update = stripAgency(args.update);
      break;
    default:
      throw new Error(`Tenant client: unsupported operation "${operation}"`);
  }
  return args;
}

export function tenantDb(agencyId: string) {
  if (!agencyId) throw new Error("tenantDb requires an agencyId");
  return prisma.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          return query(scopeArgs(operation, args, agencyId) as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
/** Interactive transaction client obtained from a TenantDb. */
export type TenantTx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];
