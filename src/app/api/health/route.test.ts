import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("health API", () => {
  it("reports local service health without touching Steam network", async () => {
    const response = GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      cache: expect.objectContaining({
        entries: expect.any(Number),
        pending: expect.any(Number),
      }),
      steamCli: expect.objectContaining({
        available: expect.any(Boolean),
        source: expect.stringMatching(/^(configured|bundled|missing)$/),
      }),
    });
  });
});
