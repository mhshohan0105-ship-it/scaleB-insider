import { describe, expect, it } from "vitest";
import { HttpTemplateProvider, getSmsProvider } from "./provider";

describe("sms provider", () => {
  it("is simulated until a gateway is configured", async () => {
    const p = getSmsProvider({} as NodeJS.ProcessEnv);
    expect(p.name).toBe("simulated");
    expect((await p.send("8801711000001", "hi")).status).toBe("SIMULATED");
  });

  it("fills the URL template and reads the gateway's answer", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      return new Response('{"response_code":202}', { status: 200 });
    }) as unknown as typeof fetch;
    const p = new HttpTemplateProvider(
      "https://gw.test/api?api_key={key}&senderid={sender}&number={to}&message={text}",
      { method: "GET", key: "K1", sender: "8809", success: /"response_code":202/ },
      fake,
    );
    const r = await p.send("8801711000001", "Visa ready & collect");
    expect(r.status).toBe("SENT");
    expect(calls[0]).toBe(
      "https://gw.test/api?api_key=K1&senderid=8809&number=8801711000001&message=Visa%20ready%20%26%20collect",
    );
  });

  it("reports a gateway refusal as failed", async () => {
    const fake = (async () =>
      new Response('{"response_code":1001}', { status: 200 })) as unknown as typeof fetch;
    const p = new HttpTemplateProvider(
      "https://gw.test/?n={to}&m={text}",
      { method: "GET", key: "", sender: "", success: /202/ },
      fake,
    );
    expect(await p.send("8801711000001", "x")).toMatchObject({ status: "FAILED" });
  });
});
