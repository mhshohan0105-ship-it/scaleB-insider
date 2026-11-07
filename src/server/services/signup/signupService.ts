// Self sign-up (Step 9): anyone may open a trial agency. When this
// installation sends SMS, the owner's mobile number is proved first with a
// 6 digit code. Limits: one trial per mobile number, a few codes per number
// per hour and a few sign-ups per network address per day. Runs before any
// session exists, so it uses the base client (documented exception, like
// provisionAgency).
import { createHash, randomInt } from "node:crypto";
import { normalizeBdMobile } from "@/lib/sms";
import { signupCodeSchema, signupSchema } from "@/lib/schemas/signup";
import { todayIso } from "@/lib/dates";
import { TRIAL_DAYS, endOfDhakaDay } from "@/lib/subscription";
import { prisma } from "@/server/db/prisma";
import { getSmsProvider, type SmsProvider } from "@/server/sms/provider";
import { provisionAgency } from "../agency/provisionAgency";
import { ServiceError, isUniqueViolation } from "../errors";
import { notify } from "../notifications/notificationService";
import { platformAgency } from "../subscription/subscriptionService";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_TRIES = 5;
const CODES_PER_PHONE_HOUR = 3;
const CODES_PER_IP_DAY = 10;
const SIGNUPS_PER_IP_DAY = 3;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

let smsOverride: { on: boolean; provider: SmsProvider | null } | null = null;
/** Tests: switch codes on or off and use a fake gateway. */
export function setSignupSmsForTests(o: typeof smsOverride) {
  smsOverride = o;
}

/** Codes are asked only when a real SMS gateway is set up (SMS_URL_TEMPLATE). */
export function signupNeedsCode(): boolean {
  return smsOverride ? smsOverride.on : Boolean(process.env.SMS_URL_TEMPLATE?.trim());
}

const hashCode = (phone: string, code: string) =>
  createHash("sha256").update(`${phone}:${code}`).digest("hex");

function mobileOf(raw: string): string {
  const phone = normalizeBdMobile(raw);
  if (!phone) throw new ServiceError("Mobile number like 01XXXXXXXXX", { phone: "Not valid" });
  return phone;
}

async function assertPhoneUnused(phone: string) {
  if (await prisma.agency.findFirst({ where: { signupPhone: phone }, select: { id: true } }))
    throw new ServiceError(
      "This mobile number already has an agency. Sign in, or contact us to open another.",
      { phone: "Already used for a trial" },
    );
}

/** Step 1: sends a 6 digit code to the mobile number. */
export async function requestSignupCode(input: unknown, ip: string | null, now = new Date()) {
  const phone = mobileOf(signupCodeSchema.parse(input).phone);
  await assertPhoneUnused(phone);
  const [byPhone, byIp] = await Promise.all([
    prisma.signupRequest.count({
      where: { phone, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
    }),
    ip
      ? prisma.signupRequest.count({
          where: { ip, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
        })
      : 0,
  ]);
  if (byPhone >= CODES_PER_PHONE_HOUR || byIp >= CODES_PER_IP_DAY)
    throw new ServiceError("Too many codes asked for. Please try again later.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.signupRequest.create({
    data: {
      phone,
      codeHash: hashCode(phone, code),
      ip,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });
  const provider = smsOverride?.provider ?? getSmsProvider();
  const sent = await provider.send(
    phone,
    `${code} is your scaleB Insider sign-up code. It expires in 10 minutes.`,
  );
  if (sent.status === "FAILED")
    throw new ServiceError("The code could not be sent. Check the number and try again.");
  return { sent: true };
}

/** Checks the newest unused code for the number; wrong tries are counted. */
async function consumeCode(phone: string, code: string | undefined, now: Date) {
  const req = await prisma.signupRequest.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!req || req.attempts >= MAX_CODE_TRIES)
    throw new ServiceError("The code has expired. Ask for a new one.", { otp: "Expired" });
  if (!code || req.codeHash !== hashCode(phone, code)) {
    await prisma.signupRequest.update({
      where: { id: req.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ServiceError("That code is not right.", { otp: "Wrong code" });
  }
  await prisma.signupRequest.update({ where: { id: req.id }, data: { usedAt: now } });
}

/** The plan a new trial starts on: "standard" when offered, else the first offered plan. */
async function trialPlan(): Promise<string> {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }],
    select: { code: true },
  });
  return (plans.find((p) => p.code === "standard") ?? plans[0])?.code ?? "standard";
}

/** Step 2: creates the trial agency and its owner. The caller then signs the owner in. */
export async function signUp(input: unknown, ip: string | null, now = new Date()) {
  const data = signupSchema.parse(input);
  if (data.website) throw new ServiceError("Sign-up failed. Please try again.");
  const phone = mobileOf(data.phone);
  await assertPhoneUnused(phone);
  if (ip) {
    const today = await prisma.signupRequest.count({
      where: { ip, usedAt: { gte: new Date(now.getTime() - DAY_MS) } },
    });
    if (today >= SIGNUPS_PER_IP_DAY)
      throw new ServiceError("Too many sign-ups from this network today. Please contact us.");
  }

  if (signupNeedsCode()) await consumeCode(phone, data.otp, now);
  else
    // No SMS here: keep a used request anyway, so the per-address limit still counts.
    await prisma.signupRequest.create({
      data: { phone, codeHash: "-", ip, expiresAt: now, usedAt: now },
    });

  // The trial runs to the end of its last Dhaka day: "14 days left" on day one.
  const trialEndsAt = endOfDhakaDay(todayIso(new Date(now.getTime() + TRIAL_DAYS * DAY_MS)));
  try {
    const { agency } = await provisionAgency(
      {
        code: data.code,
        name: data.agencyName,
        phone: `0${phone.slice(3)}`,
        email: data.email,
        owner: { name: data.ownerName, username: data.username, password: data.password },
      },
      undefined,
      { plan: await trialPlan(), trialEndsAt, signupPhone: phone },
    );
    const platform = await platformAgency();
    if (platform)
      await notify(platform.id, {
        module: "configuration",
        kind: "NEW_SIGNUP",
        title: `New trial: ${agency.name} (${agency.code})`,
        body: `${data.ownerName}, ${`0${phone.slice(3)}`}${data.email ? `, ${data.email}` : ""}`,
        link: "/admin",
      });
    return { code: agency.code, username: data.username, trialEndsAt: trialEndsAt.toISOString() };
  } catch (e) {
    if (isUniqueViolation(e))
      throw new ServiceError(`The agency code "${data.code}" is taken. Choose another.`, {
        code: "Taken",
      });
    throw e;
  }
}
