// deno test supabase/functions/_shared/verifyMn.test.ts
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { createSession, verifyPhone, VerifyMnError } from "./verifyMn.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.test("PENDING → VERIFIED", async () => {
  const states = ["PENDING", "PENDING", "VERIFIED"];
  let calls = 0;
  const fetchImpl = (() => Promise.resolve(json({ sessionId: "s1", sessionStatus: states[calls++], expiresAt: "2099-01-01T00:00:00Z" }))) as typeof fetch;
  const ok = await verifyPhone("s1", "2099-01-01T00:00:00Z", { fetchImpl, wait: () => Promise.resolve() });
  assertEquals(ok, true);
  assertEquals(calls, 3);
});

Deno.test("EXPIRED хугацаа — false", async () => {
  let t = 0;
  const fetchImpl = (() => Promise.resolve(json({ sessionId: "s2", sessionStatus: "PENDING" }))) as typeof fetch;
  const ok = await verifyPhone("s2", new Date(10_000).toISOString(), {
    fetchImpl,
    now: () => t,
    wait: (ms) => {
      t += ms;
      return Promise.resolve();
    },
  });
  assertEquals(ok, false);
});

Deno.test("EXPIRED статус — шууд false", async () => {
  const fetchImpl = (() => Promise.resolve(json({ sessionId: "s3", sessionStatus: "EXPIRED" }))) as typeof fetch;
  assertEquals(await verifyPhone("s3", "2099-01-01T00:00:00Z", { fetchImpl, wait: () => Promise.resolve() }), false);
});

Deno.test("401 буруу key", async () => {
  const fetchImpl = (() => Promise.resolve(json({ message: "Unauthorized" }, 401))) as typeof fetch;
  const err = await assertRejects(() => createSession("99112233", { apiKey: "bad", fetchImpl }), VerifyMnError);
  assertEquals((err as VerifyMnError).status, 401);
});

Deno.test("сесс бүрт шинэ код илгээнэ", async () => {
  const sent: string[] = [];
  const fetchImpl = ((_u: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)).text);
    return Promise.resolve(json({ sessionId: "x", displayInstruction: "…", expiresAt: "2099-01-01T00:00:00Z", smsUri: "sms:144773?body=1" }));
  }) as unknown as typeof fetch;
  await createSession("99112233", { apiKey: "k", fetchImpl });
  await createSession("99112233", { apiKey: "k", fetchImpl });
  assertEquals(sent.length, 2);
  assertEquals(/^\d{6}$/.test(sent[0]) && /^\d{6}$/.test(sent[1]), true);
});
