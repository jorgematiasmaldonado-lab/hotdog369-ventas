import type { Tx } from "./db";

export async function audit(
  tx: Tx,
  userId: number | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  before?: unknown,
  after?: unknown,
  notes?: string | null,
) {
  await tx`INSERT INTO audit_log (user_id, action, entity, entity_id, before, after, notes)
    VALUES (${userId}, ${action}, ${entity}, ${entityId === null ? null : String(entityId)},
            ${before === undefined ? null : tx.json(before as never)},
            ${after === undefined ? null : tx.json(after as never)}, ${notes ?? null})`;
}
