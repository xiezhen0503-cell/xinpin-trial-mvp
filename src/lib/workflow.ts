import type { Participation, ParticipationStatus, Role, WorkflowEvent } from "@/types";

export const allowedTransitions: Record<ParticipationStatus, ParticipationStatus[]> = {
  applied: ["under_review", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  rejected: [],
  approved: ["purchase_pending"],
  purchase_pending: ["purchased", "expired", "cancelled"],
  purchased: ["shipment_pending"],
  shipment_pending: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["feedback_available"],
  feedback_available: ["feedback_submitted", "expired"],
  feedback_submitted: ["feedback_revision_required", "feedback_approved"],
  feedback_revision_required: ["feedback_resubmitted", "expired"],
  feedback_resubmitted: ["feedback_revision_required", "feedback_approved"],
  feedback_approved: ["refund_pending"],
  refund_pending: ["refund_processing", "refund_failed"],
  refund_processing: ["refund_success", "refund_failed"],
  refund_success: ["completed"],
  refund_failed: ["refund_pending", "cancelled"],
  completed: [],
  expired: [],
  cancelled: [],
};

let serial = 0;
const makeId = () => `${Date.now()}-${serial++}`;

export interface TransitionResult {
  participation: Participation;
  event: WorkflowEvent;
}

export function transitionParticipation(
  participation: Participation,
  toStatus: ParticipationStatus,
  eventType: string,
  actorType: Role | "system",
  actorName: string,
  metadata?: string,
): TransitionResult {
  if (!allowedTransitions[participation.status].includes(toStatus)) {
    throw new Error(`不允许从 ${participation.status} 变更为 ${toStatus}`);
  }

  const now = new Date().toISOString();
  return {
    participation: { ...participation, status: toStatus },
    event: {
      id: `event-${makeId()}`,
      participationId: participation.id,
      eventType,
      fromStatus: participation.status,
      toStatus,
      actorType,
      actorName,
      createdAt: now,
      metadata,
    },
  };
}

export function runTransitions(
  participation: Participation,
  steps: Array<{ to: ParticipationStatus; event: string; actor: Role | "system"; name: string; metadata?: string }>,
) {
  let current = participation;
  const events: WorkflowEvent[] = [];
  for (const step of steps) {
    const result = transitionParticipation(current, step.to, step.event, step.actor, step.name, step.metadata);
    current = result.participation;
    events.push(result.event);
  }
  return { participation: current, events };
}

export function validateRefund(participation: Participation, amount: number, eligibleAmount: number) {
  if (!["feedback_approved", "refund_failed"].includes(participation.status)) return "反馈尚未审核通过";
  if (amount <= 0 || amount > eligibleAmount) return "退款金额超过可退金额";
  if (participation.refundIdempotencyKey && participation.status !== "refund_failed") return "该资格已创建退款请求";
  return null;
}
