import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PartyType } from "@prisma/client";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { MasterPage } from "@/components/masters/MasterPage";
import { PartyProfile } from "@/components/parties/PartyProfile";
import {
  InvoicesPanel,
  LedgerPanel,
  PurchasesPanel,
  ReceiptsPanel,
  AgentPaymentsPanel,
  VendorPaymentsPanel,
} from "@/components/parties/panels";
import { entityModule } from "@/lib/entities";
import { firstParam, parseListParams } from "@/lib/listParams";
import type { FieldOption, PartyKey } from "@/lib/masters";
import { PARTIES } from "@/lib/parties";
import { can, type PermissionMap } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import type { ServiceContext } from "@/server/services/context";
import { listInvoices, listVendorPurchases } from "@/server/services/invoices/invoiceCommon";
import { partyLedger } from "@/server/services/ledger/partyLedger";
import { getEntity, masterOptions } from "@/server/services/masters/masterService";
import { listMoneyReceipts } from "@/server/services/payments/receiptService";
import { listVendorPayments } from "@/server/services/payments/vendorPaymentService";
import { listVouchers } from "@/server/services/vouchers/voucherService";
import { listPassports } from "@/server/services/passports/passportService";
import { PassportListPage } from "@/components/passports/PassportPages";
import type { ExpiryState } from "@/lib/passport";
import { todayIso } from "@/lib/dates";
import { ProfileAction } from "@/components/parties/ProfileAction";
import { SetOffButton, SetOffPanel } from "@/components/parties/SetOff";
import { formatMoney } from "@/lib/format";
import type { MasterRow } from "@/server/services/masters/masterService";
import { combinedOf, listSetOffs } from "@/server/services/parties/combinedService";
import { loadEntityPage, type RawSearchParams } from "./loadEntityPage";
import { renderPlaceholder } from "./placeholder";

const PARTY_TYPE: Record<PartyKey, PartyType> = {
  clients: "CLIENT",
  combinedclients: "COMBINED",
  vendors: "VENDOR",
  agents: "AGENT",
};

/** List page for a party kind. */
export async function renderPartyList(key: PartyKey, searchParams: Promise<RawSearchParams>) {
  const data = await loadEntityPage(key, await searchParams);
  if (!data) return <AccessDenied />;
  return <MasterPage {...data} />;
}

async function loadPanel(
  key: PartyKey,
  id: string,
  tab: string,
  raw: RawSearchParams,
  ctx: ServiceContext,
  permissions: PermissionMap,
  row: MasterRow,
) {
  const params = parseListParams(raw);
  // A combined client's documents live on its linked client and vendor accounts.
  const clientId =
    key === "clients" ? id : key === "combinedclients" ? (row.clientId as string | null) : null;
  const vendorId =
    key === "vendors" ? id : key === "combinedclients" ? (row.vendorId as string | null) : null;
  if (tab === "ledger") {
    const ledger = await partyLedger(ctx, { partyType: PARTY_TYPE[key], partyId: id, ...params });
    return <LedgerPanel ledger={ledger} params={params} showSide={key === "combinedclients"} />;
  }
  if (tab === "setoffs" && key === "combinedclients") {
    return (
      <SetOffPanel
        data={await listSetOffs(ctx, id, params)}
        params={params}
        canVoid={can(permissions, "accounts", "edit")}
      />
    );
  }
  if (
    tab === "invoices" &&
    (clientId || key === "agents") &&
    can(permissions, "invoice_air", "view")
  ) {
    const data = await listInvoices(ctx, null, {
      ...params,
      ...(clientId ? { clientId } : { agentId: id }),
    });
    return <InvoicesPanel data={data} params={params} />;
  }
  if (tab === "receipts" && clientId && can(permissions, "money_receipt", "view")) {
    return (
      <ReceiptsPanel data={await listMoneyReceipts(ctx, { ...params, clientId })} params={params} />
    );
  }
  if (tab === "purchases" && vendorId && can(permissions, "invoice_air", "view")) {
    return (
      <PurchasesPanel data={await listVendorPurchases(ctx, vendorId, params)} params={params} />
    );
  }
  if (tab === "passports" && key === "clients" && can(permissions, "passport", "view")) {
    const expiry = firstParam(raw.expiry);
    const filters = {
      expiry:
        expiry && ["EXPIRED", "SOON", "OK"].includes(expiry) ? (expiry as ExpiryState) : undefined,
    };
    const data = await listPassports(ctx, { ...params, ...filters, clientId: id }, todayIso());
    return (
      <PassportListPage
        data={data}
        params={params}
        filters={filters}
        statuses={[]}
        canCreate={can(permissions, "passport", "create")}
        embedded
        newHref={`/passports/new?client=${id}`}
      />
    );
  }
  if (tab === "payments" && key === "agents") {
    return (
      <AgentPaymentsPanel
        data={await listVouchers(ctx, ["AGENT_PAYMENT"], { ...params, partyId: id })}
        params={params}
      />
    );
  }
  if (tab === "payments" && vendorId) {
    return (
      <VendorPaymentsPanel
        data={await listVendorPayments(ctx, { ...params, vendorId })}
        params={params}
      />
    );
  }
  return undefined;
}

/**
 * Profile page for a party. `id` may also be a sibling sidebar page that is not
 * built yet, which renders its placeholder instead.
 */
export async function renderPartyProfile(
  key: PartyKey,
  id: string,
  searchParams?: Promise<RawSearchParams>,
) {
  const def = PARTIES[key];
  const placeholder = await renderPlaceholder(`${def.profileBase}/${id}`);
  if (placeholder) return placeholder;

  const user = await getUserContext();
  const moduleKey = entityModule(def);
  if (!can(user.permissions, moduleKey, "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);

  const row = await getEntity(ctx, key, id);
  if (!row) notFound();

  const raw = (await searchParams) ?? {};
  const requested = firstParam(raw.tab) ?? "info";
  const tab = def.profileTabs.some((t) => t.key === requested) ? requested : "info";

  const refFields = def.fields.filter((f) => f.type === "ref" && f.ref);
  const [options, panel] = await Promise.all([
    Promise.all(refFields.map((f) => masterOptions(ctx, f.ref!))),
    tab === "info" ? undefined : loadPanel(key, id, tab, raw, ctx, user.permissions, row),
  ]);
  const balanceNote = await combinedNote(ctx, key, row);
  const refOptions: Record<string, FieldOption[]> = {};
  refFields.forEach((f, i) => (refOptions[f.name] = options[i] ?? []));

  const actions = (
    <>
      {key === "clients" && can(user.permissions, "invoice_air", "create") && (
        <Link href="/invoices/airticket/new">
          <ProfileAction label="New invoice" />
        </Link>
      )}
      {key === "combinedclients" &&
        row.clientId &&
        row.vendorId &&
        can(user.permissions, "accounts", "edit") && (
          <SetOffButton combinedId={id} today={todayIso()} />
        )}
      {(key === "clients" || (key === "combinedclients" && row.clientId)) &&
        can(user.permissions, "money_receipt", "create") && (
          <Link href={`/moneyreceipts/new?client=${key === "clients" ? id : String(row.clientId)}`}>
            <ProfileAction label="Receive money" primary />
          </Link>
        )}
      {(key === "vendors" || key === "combinedclients") &&
        can(user.permissions, "vendors", "create") && (
          <Link href="/vendors/payments">
            <ProfileAction label="Pay vendor" primary />
          </Link>
        )}
    </>
  );

  return (
    <PartyProfile
      partyKey={key}
      row={row}
      refOptions={refOptions}
      canEdit={can(user.permissions, moduleKey, "edit")}
      activeTab={tab}
      panel={panel}
      actions={actions}
      balanceNote={balanceNote}
    />
  );
}

const signedMoney = (v: string | null | undefined) => {
  if (!v || v === "0.00") return "0.00";
  return v.startsWith("-") ? `${formatMoney(v.slice(1))} Cr` : `${formatMoney(v)} Dr`;
};

/**
 * Under the balance: for a combined client, how it is made up; for a client or
 * vendor account that belongs to one, a link to it.
 */
async function combinedNote(ctx: ServiceContext, key: PartyKey, row: MasterRow) {
  if (key === "combinedclients") {
    return (
      <div style={{ fontSize: 12, lineHeight: 1.7 }}>
        {row.clientId ? (
          <div>
            Client account{" "}
            <Link href={`/clients/${String(row.clientId)}`}>{String(row.clientId__label)}</Link>:{" "}
            {signedMoney(row.clientBalance as string | null)}
          </div>
        ) : (
          <div>No client account linked</div>
        )}
        {row.vendorId ? (
          <div>
            Vendor account{" "}
            <Link href={`/vendors/${String(row.vendorId)}`}>{String(row.vendorId__label)}</Link>:{" "}
            {signedMoney(row.vendorBalance as string | null)}
          </div>
        ) : (
          <div>No vendor account linked</div>
        )}
        {row.ownBalance !== "0.00" && (
          <div>Own opening: {signedMoney(row.ownBalance as string)}</div>
        )}
      </div>
    );
  }
  if (key === "clients" || key === "vendors") {
    const c = await combinedOf(ctx, key === "clients" ? "client" : "vendor", row.id);
    if (c)
      return (
        <div style={{ fontSize: 12 }}>
          Part of combined client <Link href={`/clients/combined/${c.id}`}>{c.name}</Link>
        </div>
      );
  }
  return undefined;
}
