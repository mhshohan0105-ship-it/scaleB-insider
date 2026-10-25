// Agency logo and seal/signature image (Agency Profile). PNG or JPEG only:
// those are the formats the PDF renderer can embed. Stored in the database so
// backups include them.
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { ServiceError } from "../errors";

export const IMAGE_KINDS = ["LOGO", "SEAL"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
const MAX_BYTES = 1024 * 1024;

export function isImageKind(v: string): v is ImageKind {
  return (IMAGE_KINDS as readonly string[]).includes(v);
}

/** The real format from the file's first bytes (the browser's type is not trusted). */
export function sniffImage(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  return null;
}

export async function saveAgencyImage(ctx: ServiceContext, kind: ImageKind, bytes: Uint8Array) {
  if (bytes.length > MAX_BYTES) throw new ServiceError("The image must be 1 MB or smaller");
  const mimeType = sniffImage(bytes);
  if (!mimeType) throw new ServiceError("Upload a PNG or JPG image");
  const data = Buffer.from(bytes);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.agencyImage.findFirst({
      where: { kind },
      select: { id: true, mimeType: true, size: true },
    });
    const row = before
      ? await tx.agencyImage.update({
          where: { id: before.id },
          data: { mimeType, size: data.length, data, updatedById: ctx.userId },
        })
      : await tx.agencyImage.create({
          data: {
            agencyId: ctx.agencyId,
            kind,
            mimeType,
            size: data.length,
            data,
            updatedById: ctx.userId,
          },
        });
    await recordAudit(tx, ctx, {
      action: before ? "UPDATE" : "CREATE",
      entity: "AgencyImage",
      entityId: row.id,
      before: before ?? undefined,
      after: { kind, mimeType, size: data.length },
    });
  });
}

export async function removeAgencyImage(ctx: ServiceContext, kind: ImageKind) {
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.agencyImage.findFirst({
      where: { kind },
      select: { id: true, mimeType: true, size: true },
    });
    if (!before) return;
    await tx.agencyImage.delete({ where: { id: before.id } });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "AgencyImage",
      entityId: before.id,
      before: { kind, ...before },
      after: { kind, removed: true },
    });
  });
}

export async function getAgencyImage(ctx: ServiceContext, kind: ImageKind) {
  return tenantDb(ctx.agencyId).agencyImage.findFirst({
    where: { kind },
    select: { mimeType: true, data: true, updatedAt: true },
  });
}
