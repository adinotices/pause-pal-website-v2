import { randomBytes, createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./index";
import { magicLinkTokens, people } from "./schema";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Looks up a person by email without revealing whether it matched --
 * callers should always show the same "check your email" response either
 * way, so this alone can't be used to enumerate registered emails. */
export async function findPersonByEmail(email: string) {
  const [person] = await db
    .select()
    .from(people)
    .where(eq(people.email, email.toLowerCase().trim()))
    .limit(1);
  return person ?? null;
}

/** Creates a magic-link token for a person and returns the *raw* token --
 * only its hash is persisted, so this is the only place the raw value
 * ever exists outside the emailed link itself. */
export async function createMagicLinkToken(personId: number): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await db.insert(magicLinkTokens).values({
    personId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return rawToken;
}

/** Consumes a magic-link token: valid, unexpired, unused tokens return the
 * associated personId and are marked consumed in the same step so the
 * link can't be used twice (e.g. an email client prefetching links). */
export async function consumeMagicLinkToken(rawToken: string): Promise<number | null> {
  const tokenHash = hashToken(rawToken);

  return db.transaction(async (tx) => {
    const [token] = await tx
      .select()
      .from(magicLinkTokens)
      .where(
        and(
          eq(magicLinkTokens.tokenHash, tokenHash),
          isNull(magicLinkTokens.consumedAt),
          gt(magicLinkTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!token) return null;

    await tx
      .update(magicLinkTokens)
      .set({ consumedAt: new Date() })
      .where(eq(magicLinkTokens.id, token.id));

    return token.personId;
  });
}
