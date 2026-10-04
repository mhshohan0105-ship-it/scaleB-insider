// One-time move of Phase 2 opening balances into the ledger. In Phase 2 a
// party's opening balance was written straight into its cached balance with
// no journal entry. For each such party this backs the cached opening out and
// posts a proper opening entry (which puts it back). Idempotent: parties that
// already have an opening entry are skipped.
import { Prisma } from "@prisma/client";
import { PARTY_KEYS, type PartyKey } from "@/lib/masters";
import { PARTIES } from "@/lib/parties";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { signedOpening, syncPartyOpening, type PartyOpening } from "./opening";
import { activeEntries } from "./post";

type PartyRow = PartyOpening & { balance: Prisma.Decimal };

interface PartyDelegate {
  findMany(args: unknown): Promise<PartyRow[]>;
  update(args: unknown): Promise<unknown>;
}

export async function backfillOpeningEntries(ctx: ServiceContext): Promise<number> {
  const db = tenantDb(ctx.agencyId);
  let posted = 0;
  for (const key of PARTY_KEYS as readonly PartyKey[]) {
    const model = PARTIES[key].model;
    const parties = await (db as unknown as Record<string, PartyDelegate>)[model]!.findMany({
      where: { openingBalance: { gt: 0 } },
    });
    for (const party of parties) {
      await db.$transaction(async (tx) => {
        if ((await activeEntries(tx, "OPENING_BALANCE", party.id)).length > 0) return;
        const d = (tx as unknown as Record<string, PartyDelegate>)[model]!;
        await d.update({
          where: { id: party.id },
          data: {
            balance: { decrement: signedOpening(party.openingBalance, party.openingBalanceType) },
          },
        });
        await syncPartyOpening(tx, ctx, key, party);
        posted += 1;
      });
    }
  }
  return posted;
}
