// Opening balances for parties and money accounts, posted as journal entries
// against Opening Balance Equity (PLAN.md 6.14).
import { Prisma, type PartyType } from "@prisma/client";
import type { PartyKey } from "@/lib/masters";
import { todayIso } from "@/lib/dates";
import type { TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import type { SystemAccountKey } from "./chartOfAccounts";
import { systemAccounts } from "./ledgers";
import { repostSource, type LineInput } from "./post";

export type OpeningBalanceType = "RECEIVABLE" | "PAYABLE";

/** Where each party kind's balance lives in the ledger. */
export const PARTY_LEDGER: Record<
  PartyKey,
  { partyType: PartyType; receivable: SystemAccountKey; payable: SystemAccountKey }
> = {
  clients: { partyType: "CLIENT", receivable: "AR", payable: "AR" },
  combinedclients: { partyType: "COMBINED", receivable: "AR", payable: "AP" },
  vendors: { partyType: "VENDOR", receivable: "AP", payable: "AP" },
  agents: { partyType: "AGENT", receivable: "AGENT_PAYABLE", payable: "AGENT_PAYABLE" },
};

/** Signed balance: positive when the party owes the agency. */
export function signedOpening(amount: Prisma.Decimal | string, type: OpeningBalanceType) {
  const d = new Prisma.Decimal(amount);
  if (d.isNegative()) throw new Error("Opening balance amount cannot be negative");
  return type === "PAYABLE" ? d.negated() : d;
}

/**
 * Journal lines for a party opening balance. Receivable: debit the party's
 * account, credit Opening Balance Equity; payable: the other way round.
 */
export function partyOpeningLines(args: {
  partyAccountId: string;
  equityAccountId: string;
  partyType: PartyType;
  partyId: string;
  amount: Prisma.Decimal | string;
  type: OpeningBalanceType;
}): LineInput[] {
  const amount = new Prisma.Decimal(args.amount);
  const party = {
    ledgerAccountId: args.partyAccountId,
    partyType: args.partyType,
    partyId: args.partyId,
  };
  const equity = { ledgerAccountId: args.equityAccountId };
  return args.type === "RECEIVABLE"
    ? [
        { ...party, debit: amount },
        { ...equity, credit: amount },
      ]
    : [
        { ...equity, debit: amount },
        { ...party, credit: amount },
      ];
}

export interface PartyOpening {
  id: string;
  name: string;
  openingBalance: Prisma.Decimal;
  openingBalanceType: OpeningBalanceType;
  createdAt: Date;
}

/**
 * Makes the ledger match a party's opening balance: reverses any previous
 * opening entry and posts the current one (nothing when the amount is zero).
 */
export async function syncPartyOpening(
  tx: TenantTx,
  ctx: ServiceContext,
  key: PartyKey,
  party: PartyOpening,
) {
  const map = PARTY_LEDGER[key];
  const amount = new Prisma.Decimal(party.openingBalance);
  const accountKey = party.openingBalanceType === "RECEIVABLE" ? map.receivable : map.payable;
  const acc = await systemAccounts(tx, [accountKey, "OPENING_EQUITY"] as const);
  await repostSource(
    tx,
    ctx,
    "OPENING_BALANCE",
    party.id,
    amount.isZero()
      ? null
      : {
          // Dated on the day the party was set up.
          date: todayIso(party.createdAt),
          narration: `Opening balance: ${party.name}`,
          lines: partyOpeningLines({
            partyAccountId: acc[accountKey],
            equityAccountId: acc.OPENING_EQUITY,
            partyType: map.partyType,
            partyId: party.id,
            amount,
            type: party.openingBalanceType,
          }),
        },
  );
}

/** Opening balance of a money account: debit the account, credit Opening Balance Equity. */
export async function syncMoneyAccountOpening(
  tx: TenantTx,
  ctx: ServiceContext,
  account: { id: string; name: string; openingBalance: Prisma.Decimal; createdAt: Date },
) {
  const amount = new Prisma.Decimal(account.openingBalance);
  const { OPENING_EQUITY } = await systemAccounts(tx, ["OPENING_EQUITY"] as const);
  await repostSource(
    tx,
    ctx,
    "MONEY_ACCOUNT_OPENING",
    account.id,
    amount.isZero()
      ? null
      : {
          date: todayIso(account.createdAt),
          narration: `Opening balance: ${account.name}`,
          lines: [
            { moneyAccountId: account.id, debit: amount },
            { ledgerAccountId: OPENING_EQUITY, credit: amount },
          ],
        },
  );
}
