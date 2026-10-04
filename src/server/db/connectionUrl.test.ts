import { describe, expect, it } from "vitest";
import { runtimeDatabaseUrl } from "./connectionUrl";

describe("runtimeDatabaseUrl", () => {
  it("adds PgBouncer and wake-up settings for Neon's pooled endpoint", () => {
    const out = new URL(
      runtimeDatabaseUrl(
        "postgresql://u:p@ep-cool-name-123-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require",
      )!,
    );
    expect(out.searchParams.get("pgbouncer")).toBe("true");
    expect(out.searchParams.get("connect_timeout")).toBe("15");
    expect(out.searchParams.get("sslmode")).toBe("require");
  });

  it("keeps settings that are already there", () => {
    const out = new URL(
      runtimeDatabaseUrl("postgresql://u:p@x-pooler.neon.tech/db?connect_timeout=30")!,
    );
    expect(out.searchParams.get("connect_timeout")).toBe("30");
  });

  it("leaves direct and local URLs alone", () => {
    const local = "postgresql://postgres:pw@localhost:5432/scaleb_insider?schema=public";
    expect(runtimeDatabaseUrl(local)).toBe(local);
    const direct = "postgresql://u:p@ep-cool-name-123.ap-southeast-1.aws.neon.tech/db";
    expect(runtimeDatabaseUrl(direct)).toBe(direct);
    expect(runtimeDatabaseUrl(undefined)).toBeUndefined();
  });
});
