// Feedback (sidebar "Feedback"): anyone signed in can send a bug, idea or
// question; people who manage Configuration read, reply and close them.
import { Prisma, type FeedbackStatus } from "@prisma/client";
import { z } from "zod";
import type { ListParams } from "@/lib/listParams";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError } from "../errors";
import { notify } from "../notifications/notificationService";

export const feedbackSchema = z.object({
  kind: z.enum(["BUG", "IDEA", "QUESTION", "OTHER"]).default("IDEA"),
  message: z
    .string({ error: "Write your feedback" })
    .trim()
    .min(5, "Write a little more")
    .max(2000),
  page: z.string().trim().max(200).nullable().optional(),
});

export const feedbackReplySchema = z.object({
  reply: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["OPEN", "DONE"]),
});

export async function sendFeedback(ctx: ServiceContext, input: unknown) {
  const data = feedbackSchema.parse(input);
  const f = await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const row = await tx.feedback.create({
      data: {
        agencyId: ctx.agencyId,
        userId: ctx.userId,
        kind: data.kind,
        message: data.message,
        page: data.page ?? null,
      },
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Feedback",
      entityId: row.id,
      after: row,
    });
    return row;
  });
  await notify(ctx.agencyId, {
    module: "configuration",
    kind: "FEEDBACK",
    title: `New feedback: ${data.message.slice(0, 60)}`,
    link: "/feedback",
  });
  return { id: f.id };
}

export async function replyFeedback(ctx: ServiceContext, id: string, input: unknown) {
  const data = feedbackReplySchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.feedback.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Feedback");
    const after = await tx.feedback.update({
      where: { id },
      data: {
        reply: data.reply ?? before.reply,
        status: data.status,
        resolvedAt: data.status === "DONE" ? (before.resolvedAt ?? new Date()) : null,
      },
    });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "Feedback",
      entityId: id,
      before,
      after,
    });
  });
}

/** Everyone's feedback (managers) or only one's own. */
export async function listFeedback(
  ctx: ServiceContext,
  params: ListParams & { feedbackStatus?: FeedbackStatus },
  own: boolean,
) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.FeedbackWhereInput = {};
  if (own) where.userId = ctx.userId;
  if (params.feedbackStatus) where.status = params.feedbackStatus;
  const [rows, total] = await Promise.all([
    db.feedback.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.feedback.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((f) => ({
      id: f.id,
      kind: f.kind,
      message: f.message,
      page: f.page,
      status: f.status,
      reply: f.reply,
      from: f.user?.name ?? "-",
      at: f.createdAt.toISOString(),
    })),
  };
}

export type FeedbackList = Awaited<ReturnType<typeof listFeedback>>;
