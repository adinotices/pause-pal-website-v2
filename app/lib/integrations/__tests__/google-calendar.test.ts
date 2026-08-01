import { generateKeyPairSync, createVerify } from "crypto";
import { describe, expect, it } from "vitest";
import { buildEventPayload, signServiceAccountJWT } from "../google-calendar";

function base64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

describe("signServiceAccountJWT", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  it("produces a JWT with correct header, claims, and a verifiable signature", () => {
    const nowSeconds = 1_700_000_000;
    const jwt = signServiceAccountJWT(
      "pausepal@example.iam.gserviceaccount.com",
      privateKey,
      "https://www.googleapis.com/auth/calendar",
      nowSeconds,
    );

    const [encodedHeader, encodedClaims, encodedSignature] = jwt.split(".");
    const header = JSON.parse(base64urlDecode(encodedHeader));
    const claims = JSON.parse(base64urlDecode(encodedClaims));

    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims).toMatchObject({
      iss: "pausepal@example.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    });

    const signingInput = `${encodedHeader}.${encodedClaims}`;
    const isValid = createVerify("RSA-SHA256")
      .update(signingInput)
      .verify(publicKey, Buffer.from(encodedSignature, "base64url"));
    expect(isValid).toBe(true);
  });

  it("rejects verification against a tampered payload", () => {
    const jwt = signServiceAccountJWT("a@b.com", privateKey, "scope", 1000);
    const [encodedHeader, , encodedSignature] = jwt.split(".");
    const tamperedClaims = Buffer.from(JSON.stringify({ iss: "attacker@evil.com" })).toString(
      "base64url",
    );
    const tamperedSigningInput = `${encodedHeader}.${tamperedClaims}`;
    const isValid = createVerify("RSA-SHA256")
      .update(tamperedSigningInput)
      .verify(publicKey, Buffer.from(encodedSignature, "base64url"));
    expect(isValid).toBe(false);
  });
});

describe("buildEventPayload", () => {
  it("builds a weekly-recurring event with both attendees and the Zoom link in the description", () => {
    const payload = buildEventPayload({
      summary: "PausePal: Alice & Bob",
      description: "Join via Zoom: https://zoom.us/j/123",
      location: "https://zoom.us/j/123",
      startISO: "2026-10-05T06:00:00.000Z",
      endISO: "2026-10-05T06:15:00.000Z",
      attendeeEmails: ["alice@example.com", "bob@example.com"],
      weekCount: 4,
    });

    expect(payload.recurrence).toEqual(["RRULE:FREQ=WEEKLY;COUNT=4"]);
    expect(payload.attendees).toEqual([
      { email: "alice@example.com" },
      { email: "bob@example.com" },
    ]);
    expect(payload.description).toContain("zoom.us");
  });

  // Google's Calendar API documents start.timeZone/end.timeZone as
  // *required* for recurring events ("specifies the time zone in which the
  // recurrence is expanded"), so omitting it would fail every send.
  it("sends an explicit timeZone on start and end, as recurring events require", () => {
    const payload = buildEventPayload({
      summary: "PausePal: Alice & Bob",
      description: "Join via Zoom: https://zoom.us/j/123",
      startISO: "2026-10-05T06:00:00.000Z",
      endISO: "2026-10-05T06:15:00.000Z",
      attendeeEmails: ["alice@example.com"],
      weekCount: 4,
    });

    expect(payload.start).toEqual({ dateTime: "2026-10-05T06:00:00.000Z", timeZone: "UTC" });
    expect(payload.end).toEqual({ dateTime: "2026-10-05T06:15:00.000Z", timeZone: "UTC" });
  });
});
