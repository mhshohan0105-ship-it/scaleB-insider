// Creates a money account together with its own asset ledger (codes 1101-1199).
// Takes agencyId explicitly so provisioning (before any session) can use it.
import type { MoneyAccountKind, Prisma } from "@prisma/client";
import type { TenantTx } from "@/server/db/tenant";
import { nextSequence } from "@/server/services/numbering/sequence";
import { MONEY_LEDGER_CODE_END, MONEY_LEDGER_CODE_START } from "./chartOfAccounts";
import { AccountingError } from "./validate";

export interface MoneyAccountRecord {
  name: string;
  kind: MoneyAccountKind;
  bankName?: string | null;
  accountNoMasked?: string | null;
  branch?: string | null;
  openingBalance?: Prisma.Decimal;
  note?: string | null;
}

export async function createMoneyAccountWithLedger(
  tx: TenantTx | Prisma.TransactionClient,
  agencyId: string,
  data: MoneyAccountRecord,
  createdById: string | null = null,
) {
  const n = await nextSequence(tx as TenantTx, agencyId, "MONEY_LEDGER");
  const code = MONEY_LEDGER_CODE_START + n - 1;
  if (code > MONEY_LEDGER_CODE_END) throw new AccountingError("Too many money accounts");

  const base = tx as Prisma.TransactionClient;
  const ledger = await base.ledgerAccount.create({
    data: { agencyId, code: String(code), name: data.name, type: "ASSET", createdById },
  });
  return base.moneyAccount.create({
    data: {
      agencyId,
      name: data.name,
      kind: data.kind,
      bankName: data.bankName ?? null,
      accountNoMasked: data.accountNoMasked ?? null,
      branch: data.branch ?? null,
      openingBalance: data.openingBalance ?? 0,
      note: data.note ?? null,
      ledgerAccountId: ledger.id,
      createdById,
    },
  });
}
