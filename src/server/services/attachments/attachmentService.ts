// Small files kept with a document (expense bills, passport scans), stored in
// the database so backups carry them. PDF and images only, up to 2 MB.
import type { ModuleKey } from "@/lib/permissions";
import { VOUCHER_KIND_INFO } from "@/lib/voucherKinds";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";

export const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
export const ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export type AttachmentTarget = { voucherId: string } | { passportId: string };

/** The module whose permissions guard a target (null when it does not exist). */
export async function attachmentModule(
  ctx: ServiceContext,
  target: AttachmentTarget,
): Promise<ModuleKey | null> {
  const db = tenantDb(ctx.agencyId);
  if ("voucherId" in target) {
    const v = await db.voucher.findFirst({
      where: { id: target.voucherId },
      select: { kind: true },
    });
    return v ? VOUCHER_KIND_INFO[v.kind].module : null;
  }
  const p = await db.passport.findFirst({ where: { id: target.passportId }, select: { id: true } });
  return p ? "passport" : null;
}

export async function addAttachment(
  ctx: ServiceContext,
  target: AttachmentTarget,
  file: { name: string; type: string; bytes: Uint8Array },
): Promise<{ id: string }> {
  if (!ATTACHMENT_TYPES.includes(file.type))
    throw new ServiceError("Attach a PDF or an image (JPG, PNG, WEBP)");
  if (file.bytes.byteLength > ATTACHMENT_MAX_BYTES)
    throw new ServiceError("The file is larger than 2 MB");
  if (!(await attachmentModule(ctx, target))) throw new NotFoundError("Document");
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const a = await tx.attachment.create({
      data: {
        agencyId: ctx.agencyId,
        ...target,
        fileName: file.name.slice(0, 120),
        mimeType: file.type,
        size: file.bytes.byteLength,
        data: Buffer.from(file.bytes),
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Attachment",
      entityId: a.id,
      after: { ...target, fileName: a.fileName, size: a.size },
    });
    return { id: a.id };
  });
}

export async function getAttachment(ctx: ServiceContext, id: string) {
  const file = await tenantDb(ctx.agencyId).attachment.findFirst({ where: { id } });
  if (!file) return null;
  const target: AttachmentTarget | null = file.voucherId
    ? { voucherId: file.voucherId }
    : file.passportId
      ? { passportId: file.passportId }
      : null;
  return { file, module: target ? await attachmentModule(ctx, target) : null };
}
