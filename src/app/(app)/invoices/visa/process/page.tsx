import { AccessDenied } from "@/components/ModulePlaceholder";
import { firstParam } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { visaBoard } from "@/server/services/invoices/visaInvoiceService";
import type { RawSearchParams } from "../../../loadEntityPage";
import { VisaBoard } from "./VisaBoard";

export default async function VisaProcessPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "invoice_visa", "view")) return <AccessDenied />;
  const q = firstParam((await searchParams).q) ?? "";
  const cards = await visaBoard(await toServiceContext(user), q);
  return <VisaBoard cards={cards} q={q} canMove={can(user.permissions, "invoice_visa", "edit")} />;
}
