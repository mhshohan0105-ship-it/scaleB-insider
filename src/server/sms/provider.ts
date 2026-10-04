// SMS gateway (PLAN.md Phase 12). The gateway is not chosen yet (PLAN.md
// section 14), so any HTTP gateway can be plugged in with environment
// variables; without them messages are only logged ("simulated").
//
//   SMS_URL_TEMPLATE   e.g. https://gateway.example/api?api_key={key}&senderid={sender}&number={to}&message={text}
//   SMS_METHOD         GET (default) or POST (the template's query becomes a form body)
//   SMS_API_KEY        substituted for {key}
//   SMS_SENDER_ID      substituted for {sender}
//   SMS_SUCCESS_REGEX  optional; the response body must match it to count as sent

export interface SmsResult {
  status: "SENT" | "FAILED" | "SIMULATED";
  providerRef?: string | null;
  error?: string | null;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string): Promise<SmsResult>;
}

class SimulatedProvider implements SmsProvider {
  readonly name = "simulated";
  async send(): Promise<SmsResult> {
    return { status: "SIMULATED", error: "No SMS gateway configured (SMS_URL_TEMPLATE)" };
  }
}

export class HttpTemplateProvider implements SmsProvider {
  readonly name = "http";
  constructor(
    private readonly template: string,
    private readonly opts: {
      method: "GET" | "POST";
      key: string;
      sender: string;
      success?: RegExp;
    },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  url(to: string, text: string): string {
    const values: Record<string, string> = {
      to,
      text,
      key: this.opts.key,
      sender: this.opts.sender,
    };
    return this.template.replace(/\{(to|text|key|sender)\}/g, (_, k: string) =>
      encodeURIComponent(values[k] ?? ""),
    );
  }

  async send(to: string, text: string): Promise<SmsResult> {
    const full = this.url(to, text);
    try {
      const res =
        this.opts.method === "POST"
          ? await this.fetchImpl(full.split("?")[0]!, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: full.includes("?") ? full.slice(full.indexOf("?") + 1) : "",
              signal: AbortSignal.timeout(15_000),
            })
          : await this.fetchImpl(full, { signal: AbortSignal.timeout(15_000) });
      const body = (await res.text()).slice(0, 500);
      if (!res.ok) return { status: "FAILED", error: `HTTP ${res.status}: ${body}` };
      if (this.opts.success && !this.opts.success.test(body))
        return { status: "FAILED", error: body };
      return { status: "SENT", providerRef: body.slice(0, 120) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : String(e) };
    }
  }
}

export function getSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  const template = env.SMS_URL_TEMPLATE?.trim();
  if (!template) return new SimulatedProvider();
  return new HttpTemplateProvider(template, {
    method: env.SMS_METHOD?.toUpperCase() === "POST" ? "POST" : "GET",
    key: env.SMS_API_KEY ?? "",
    sender: env.SMS_SENDER_ID ?? "",
    success: env.SMS_SUCCESS_REGEX ? new RegExp(env.SMS_SUCCESS_REGEX) : undefined,
  });
}
