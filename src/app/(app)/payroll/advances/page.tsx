import type { RawSearchParams } from "../../loadEntityPage";
import { renderVoucherPage } from "../../vouchers/routes";

export default function EmployeeAdvancePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return renderVoucherPage("EMPLOYEE_ADVANCE", searchParams, {
    description: "Advances to employees, recovered later from their salary.",
  });
}
