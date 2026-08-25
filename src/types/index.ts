export type Role = "consumer" | "merchant" | "admin";

export type ParticipationStatus =
  | "applied"
  | "under_review"
  | "rejected"
  | "approved"
  | "purchase_pending"
  | "purchased"
  | "shipment_pending"
  | "shipped"
  | "delivered"
  | "feedback_available"
  | "feedback_submitted"
  | "feedback_revision_required"
  | "feedback_resubmitted"
  | "feedback_approved"
  | "refund_pending"
  | "refund_processing"
  | "refund_success"
  | "refund_failed"
  | "completed"
  | "expired"
  | "cancelled";

export interface Campaign {
  id: string;
  brand: string;
  title: string;
  subtitle: string;
  category: "bakery" | "tea" | "snack" | "roujiamo" | "saqima" | "cracker" | "hawthorn" | "soup" | "dumpling" | "beer";
  price: number;
  refundAmount: number;
  quota: number;
  applications: number;
  deadline: string;
  feedbackDays: number;
  accent: string;
  requirements: string[];
  launchStatus?: "open" | "preparing";
  trialMode: "free" | "low_price" | "pending";
  sampleStatus?: string[];
  visualLabel?: string;
}

export interface Feedback {
  overall: number;
  taste: number;
  packaging: number;
  value: number;
  repurchase: "会" | "可能会" | "不会";
  liked: string;
  improve: string;
  review: string;
  photos: number;
}

export interface Participation {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  city: string;
  age: string;
  reason: string;
  status: ParticipationStatus;
  submittedAt: string;
  purchaseExpiresAt?: string;
  qualificationToken?: string;
  trackingNumber?: string;
  feedbackDeadline?: string;
  feedback?: Feedback;
  revisionReason?: string;
  refundIdempotencyKey?: string;
  refundFailureReason?: string;
}

export interface WorkflowEvent {
  id: string;
  participationId: string;
  eventType: string;
  fromStatus: ParticipationStatus;
  toStatus: ParticipationStatus;
  actorType: Role | "system";
  actorName: string;
  createdAt: string;
  metadata?: string;
}

export interface AppState {
  participations: Participation[];
  events: WorkflowEvent[];
  notifications: { id: string; title: string; body: string; read: boolean; createdAt: string }[];
}
