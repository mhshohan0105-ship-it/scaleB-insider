import { describe, expect, it } from "vitest";
import type { ItemInvoiceView } from "@/server/services/invoices/itemInvoiceService";
import type { VisaInvoiceView } from "@/server/services/invoices/visaInvoiceService";
import { itemDocument, visaDocument } from "./invoiceDocument";

const header = {
  id: "inv1",
  number: "TUR-2026-00001",
  status: "UNPAID",
  date: "2026-09-27",
  dueDate: null,
  client: { id: "c1", name: "Client", code: "CL-0001", phone: null, email: null, address: null },
  subtotal: "50000.00",
  discount: "0.00",
  serviceCharge: "0.00",
  vat: "0.00",
  netTotal: "50000.00",
  paidAmount: "0.00",
  due: "50000.00",
  note: null,
};

const item = (over: Partial<ItemInvoiceView["items"][number]>) =>
  ({
    id: "i",
    kind: "SERVICE",
    product: null,
    description: "Line",
    qty: "1",
    unitPrice: "0.00",
    clientPrice: "0.00",
    passengerName: null,
    passportNo: null,
    roomType: null,
    serviceDate: null,
    ...over,
  }) as ItemInvoiceView["items"][number];

describe("invoice PDF document", () => {
  it("prints priced item lines only and never shows cost", () => {
    const doc = itemDocument({
      ...header,
      type: "TOUR",
      tourGroup: { id: "t", name: "Nepal October" },
      group: null,
      travelDate: "2026-10-10",
      returnDate: "2026-10-15",
      items: [
        item({
          id: "a",
          description: "Package",
          qty: "2",
          unitPrice: "25000.00",
          clientPrice: "50000.00",
        }),
        item({
          id: "b",
          description: "Hotel cost",
          unitCost: "30000.00",
          purchasePrice: "30000.00",
        }),
      ],
    } as unknown as ItemInvoiceView);
    expect(doc.typeLabel).toBe("Tour package");
    expect(doc.rows.map((r) => r.id)).toEqual(["a"]);
    expect(doc.rows[0]!.cells.map((c) => c.main)).toEqual([
      "Package",
      "",
      "2",
      "25,000.00",
      "50,000.00",
    ]);
    expect(doc.extraMeta).toEqual(["Tour: Nepal October", "Travel: 10 Oct 2026 to 15 Oct 2026"]);
    expect(JSON.stringify(doc)).not.toContain("30,000");
  });

  it("maps visa lines to passenger, country and price", () => {
    const doc = visaDocument({
      ...header,
      type: "VISA",
      lines: [
        {
          id: "v",
          passengerName: "RAHIM",
          passportNo: "A1234567",
          country: "Thailand",
          visaType: "Tourist",
          clientPrice: "6500.00",
          purchasePrice: "5200.00",
        },
      ],
    } as unknown as VisaInvoiceView);
    expect(doc.rows[0]!.cells).toEqual([
      { main: "RAHIM", sub: "A1234567" },
      { main: "Thailand" },
      { main: "Tourist" },
      { main: "6,500.00" },
    ]);
  });
});
