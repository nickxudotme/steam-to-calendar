import { describe, expect, it } from "vitest";
import { POST } from "./route";

function previewRequest(body: BodyInit, contentType = "application/json") {
  return new Request("https://example.test/api/preview?lang=english&uiLang=en", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

async function responseJson(response: Response) {
  return response.json() as Promise<{ code: string; message: string }>;
}

describe("preview API request validation", () => {
  it("returns 400 for malformed JSON bodies", async () => {
    const response = await POST(previewRequest("{"));

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "invalid_json",
    });
  });

  it("returns 400 for non-object JSON bodies", async () => {
    const response = await POST(previewRequest(JSON.stringify(["76561198115468824"])));

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "invalid_body",
    });
  });

  it("returns 400 when steamId64 is missing", async () => {
    const response = await POST(previewRequest(JSON.stringify({ wishlist: true })));

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "invalid_steam_id",
    });
  });

  it("returns 400 for invalid config field shapes", async () => {
    const response = await POST(
      previewRequest(
        JSON.stringify({
          steamId64: "76561198115468824",
          count: { nested: true },
        }),
      ),
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "invalid_request",
    });
  });
});
