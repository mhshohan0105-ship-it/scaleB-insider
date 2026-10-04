import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getMoneyReceipt } from "@/server/services/payments/receiptService";
import { ReceiptView } from "./ReceiptView";

export default async function MoneyReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  if (!can(user.permissions, "money_receipt", "view")) return <AccessDenied />;
  const receipt = await getMoneyReceipt(await toServiceContext(user), id);
  if (!receipt) notFound();
  return <ReceiptView receipt={receipt} canVoid={can(user.permissions, "money_receipt", "void")} />;
}
