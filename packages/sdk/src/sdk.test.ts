import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouter, TheMinutesError } from "./index";

const DEFAULT_BASE = "https://api.theminutes.xyz";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentSpy: any = null;

function mockFetch(response: unknown, status = 200, ok = true) {
  currentSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status,
    json: async () => response,
  } as unknown as Response);
}

function getLastCall() {
  const calls = currentSpy?.mock.calls as Array<
    [string, RequestInit?] | undefined
  >;
  return calls?.[calls.length - 1] as [string, RequestInit?] | undefined;
}

function getLastCallUrl() {
  return getLastCall()?.[0] ?? "";
}

function getLastCallBody() {
  const body = getLastCall()?.[1]?.body;
  return body ? (JSON.parse(body as string) as Record<string, unknown>) : null;
}

describe("createRouter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    currentSpy = null;
  });

  it("throws if apiKey is missing", () => {
    expect(() =>
      // @ts-expect-error apiKey is required
      createRouter({}),
    ).toThrow(TheMinutesError);
    expect(() => createRouter({ apiKey: "" })).toThrow(TheMinutesError);
  });

  it("throws with code CONFIG_ERROR", () => {
    try {
      createRouter({ apiKey: "" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TheMinutesError);
      expect((err as TheMinutesError).code).toBe("CONFIG_ERROR");
    }
  });

  it("uses custom baseUrl when provided", async () => {
    mockFetch([]);
    const router = createRouter({
      apiKey: "tm_test",
      baseUrl: "https://custom.example.com",
    });
    await router.list("ai-model");
    expect(getLastCallUrl()).toContain(
      "https://custom.example.com/v1/services/ai-model",
    );
  });

  it("uses DEFAULT_BASE_URL when baseUrl not provided", async () => {
    mockFetch([]);
    const router = createRouter({ apiKey: "tm_test" });
    await router.list("ai-model");
    expect(getLastCallUrl()).toContain(`${DEFAULT_BASE}/v1/services/ai-model`);
  });
});

describe("router.fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    currentSpy = null;
  });

  it("sends POST /v1/route with correct body", async () => {
    const mockResult = {
      data: { result: "ok" },
      _routing: {
        providerId: "p1",
        providerName: "OpenAI",
        strategy: "balanced",
        reason: "Balanced score 0.87",
        providerCost: 0.01,
        takeRate: 0.001,
        totalCost: 0.011,
        latencyMs: 120,
      },
    };
    mockFetch(mockResult);

    const router = createRouter({
      apiKey: "tm_test",
      strategy: "cheapest",
    });
    const result = await router.fetch("ai-model", { prompt: "hello" });

    expect(getLastCallUrl()).toBe(`${DEFAULT_BASE}/v1/route`);
    expect(getLastCallBody()).toMatchObject({
      service: "ai-model",
      params: { prompt: "hello" },
      strategy: "cheapest",
    });
    expect(result).toEqual(mockResult);
  });

  it("uses default strategy from config", async () => {
    mockFetch({ data: {}, _routing: {} });
    const router = createRouter({
      apiKey: "tm_test",
      strategy: "fastest",
    });
    await router.fetch("ai-model", {});
    expect(getLastCallBody()?.strategy).toBe("fastest");
  });

  it("per-call strategy override is sent in body", async () => {
    mockFetch({ data: {}, _routing: {} });
    const router = createRouter({
      apiKey: "tm_test",
      strategy: "cheapest",
    });
    await router.fetch("ai-model", {}, { strategy: "balanced" });
    expect(getLastCallBody()?.strategy).toBe("balanced");
  });
});

describe("router.list", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    currentSpy = null;
  });

  it("calls GET /v1/services/{serviceType}", async () => {
    const providers = [{ id: "p1", name: "OpenAI" }];
    mockFetch(providers);

    const router = createRouter({ apiKey: "tm_test" });
    const result = await router.list("ai-model");

    expect(getLastCallUrl()).toContain("/v1/services/ai-model");
    expect(result).toEqual(providers);
  });
});

describe("router.preview", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    currentSpy = null;
  });

  it("calls GET /v1/route/preview with strategy query param", async () => {
    const candidates = [
      { provider: { id: "p1" }, rank: 1, score: 1, reason: "Cheapest" },
    ];
    mockFetch({ candidates, strategy: "cheapest" });

    const router = createRouter({ apiKey: "tm_test" });
    await router.preview("ai-model", { strategy: "cheapest" });

    expect(getLastCallUrl()).toContain("/v1/route/preview");
    expect(getLastCallUrl()).toContain("service=ai-model");
    expect(getLastCallUrl()).toContain("strategy=cheapest");
  });

  it("uses default strategy when no override", async () => {
    mockFetch({ candidates: [], strategy: "balanced" });
    const router = createRouter({
      apiKey: "tm_test",
      strategy: "balanced",
    });
    await router.preview("ai-model");
    expect(getLastCallUrl()).toContain("strategy=balanced");
  });
});

describe("error handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    currentSpy = null;
  });

  it("throws TheMinutesError on 4xx", async () => {
    mockFetch({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401, false);

    const router = createRouter({ apiKey: "tm_bad" });
    try {
      await router.list("ai-model");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TheMinutesError);
      expect((err as TheMinutesError).message).toBe("Unauthorized");
      expect((err as TheMinutesError).code).toBe("UNAUTHORIZED");
      expect((err as TheMinutesError).statusCode).toBe(401);
    }
  });

  it("throws TheMinutesError on 5xx", async () => {
    mockFetch(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      500,
      false,
    );

    const router = createRouter({ apiKey: "tm_test" });
    try {
      await router.fetch("ai-model", {});
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TheMinutesError);
      expect((err as TheMinutesError).statusCode).toBe(500);
    }
  });

  it("preserves Authorization header on error responses", async () => {
    mockFetch({ error: "Bad", code: "BAD" }, 400, false);
    const router = createRouter({ apiKey: "tm_secret" });
    try {
      await router.list("ai-model");
    } catch {
      // expected
    }
    const headers = getLastCall()?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.Authorization).toBe("Bearer tm_secret");
  });
});
