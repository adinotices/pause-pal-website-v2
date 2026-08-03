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
 * associated personId and are marked consumed atomically so the link
 * can't be used twice (e.g. an email client prefetching links, or two
 * concurrent requests for the same click). The `WHERE consumedAt IS NULL`
 * is checked by Postgres as part of the single UPDATE statement itself,
 * not in a separate SELECT beforehand -- a select-then-update pattern
 * would leave a window where two concurrent transactions both see the
 * token as unconsumed before either commits its update. */
export async function consumeMagicLinkToken(rawToken: string): Promise<number | null> {
  const tokenHash = hashToken(rawToken);

  const [token] = await db
    .update(magicLinkTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(magicLinkTokens.tokenHash, tokenHash),
        isNull(magicLinkTokens.consumedAt),
        gt(magicLinkTokens.expiresAt, new Date()),
      ),
    )
    .returning({ personId: magicLinkTokens.personId });

  return token?.personId ?? null;
}
