/**
 * SUPPRESSION LEDGER
 * ============================================================================
 * A hard bounce or a spam complaint from Resend must permanently stop mail to
 * that address. Kept out of `route.ts` because Next.js route modules may only
 * export HTTP verbs and the route-segment config.
 *
 * RA 10173 / NPC: once a recipient marks a message as spam, continuing to send
 * to them is not a marketing decision you are allowed to make for them.
 * ============================================================================
 */
import { withDb } from "@/lib/integrations/db";
export async function suppressSubscriber(email: string, reason: string, providerEventId: string): Promise<boolean> {
  return withDb(
    async (db) => {
      const now = new Date();
      const existing = await db.subscriber.findUnique({ where: { email }, select: { id: true, isActive: true } });

      const subscriberId = existing
        ? await db.subscriber
            .update({ where: { id: existing.id }, data: { isActive: false, unsubscribedAt: now }, select: { id: true } })
            .then((r) => r.id)
        : await db.subscriber.create({ data: { email, isActive: false, unsubscribedAt: now, source: "webhook" }, select: { id: true } }).then((r) => r.id);

      await db.auditLog.create({
        data: {
          action: "subscriber.suppressed",
          entity: "Subscriber",
          entityId: subscriberId,
          // The email itself is PII; the reason and the event id are the parts
          // an operator actually needs.
          meta: { reason, provider: "resend", providerEventId: providerEventId.slice(0, 120) },
        },
      });

      return true;
    },
    false,
    { event: "resend.suppress" },
  );
}
