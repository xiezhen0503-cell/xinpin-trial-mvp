import { describe, expect, it } from "vitest";
import type { Participation } from "@/types";
import { runTransitions, transitionParticipation, validateRefund } from "./workflow";

const application: Participation = {
  id: "p-1",
  campaignId: "c-1",
  userId: "u-1",
  userName: "小雨",
  city: "杭州",
  age: "25-34",
  reason: "想认真体验",
  status: "under_review",
  submittedAt: "2026-08-24T00:00:00.000Z",
};

describe("TrialWorkflowService", () => {
  it("只允许状态机声明的变更", () => {
    expect(transitionParticipation(application, "approved", "approved", "merchant", "商家").participation.status).toBe("approved");
    expect(() => transitionParticipation(application, "refund_success", "skip", "merchant", "商家")).toThrow("不允许");
  });

  it("为连续自动化步骤逐条记录事件", () => {
    const result = runTransitions(application, [
      { to: "approved", event: "trial_application_approved", actor: "merchant", name: "商家" },
      { to: "purchase_pending", event: "qualification_issued", actor: "system", name: "工作流引擎" },
    ]);
    expect(result.participation.status).toBe("purchase_pending");
    expect(result.events).toHaveLength(2);
  });

  it("阻止超额和不合格退款", () => {
    expect(validateRefund(application, 39.9, 39.9)).toBe("反馈尚未审核通过");
    expect(validateRefund({ ...application, status: "feedback_approved" }, 40, 39.9)).toBe("退款金额超过可退金额");
    expect(validateRefund({ ...application, status: "feedback_approved" }, 39.9, 39.9)).toBeNull();
  });
});
