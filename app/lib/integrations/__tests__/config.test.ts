import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmailConfigured, isGoogleCalendarConfigured, isZoomConfigured } from "../config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isZoomConfigured", () => {
  it("is false when any required var is missing", () => {
    vi.stubEnv("ZOOM_ACCOUNT_ID", "acct");
    vi.stubEnv("ZOOM_CLIENT_ID", "id");
    vi.stubEnv("ZOOM_CLIENT_SECRET", "");
    vi.stubEnv("ZOOM_HOST_EMAIL", "host@example.com");
    expect(isZoomConfigured()).toBe(false);
  });

  it("is true once every required var is set", () => {
    vi.stubEnv("ZOOM_ACCOUNT_ID", "acct");
    vi.stubEnv("ZOOM_CLIENT_ID", "id");
    vi.stubEnv("ZOOM_CLIENT_SECRET", "secret");
    vi.stubEnv("ZOOM_HOST_EMAIL", "host@example.com");
    expect(isZoomConfigured()).toBe(true);
  });
});

describe("isGoogleCalendarConfigured", () => {
  it("is false when the calendar id is missing", () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "sa@example.iam.gserviceaccount.com");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "key");
    vi.stubEnv("GOOGLE_CALENDAR_ID", "");
    expect(isGoogleCalendarConfigured()).toBe(false);
  });

  it("is true once every required var is set", () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "sa@example.iam.gserviceaccount.com");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "key");
    vi.stubEnv("GOOGLE_CALENDAR_ID", "cal-id");
    expect(isGoogleCalendarConfigured()).toBe(true);
  });
});

describe("isEmailConfigured", () => {
  it("reflects whether RESEND_API_KEY is set", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(isEmailConfigured()).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_123");
    expect(isEmailConfigured()).toBe(true);
  });
});
