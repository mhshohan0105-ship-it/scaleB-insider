import { firstParam } from "@/lib/listParams";
import type { RawSearchParams } from "../../loadEntityPage";
import { renderReport } from "../renderReport";
import { StatementTabs } from "./StatementTabs";

export default async function AccountingReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const which = firstParam(raw.report) === "balance-sheet" ? "balance-sheet" : "trial-balance";
  return (
    <>
      <StatementTabs active={which} />
      {await renderReport(which, Promise.resolve(raw), { filters: ["asOf"] })}
    </>
  );
}
