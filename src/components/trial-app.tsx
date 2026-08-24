"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  FileText,
  Gauge,
  House,
  Inbox,
  LayoutDashboard,
  Leaf,
  LogOut,
  PackageCheck,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { campaigns, initialState, statusLabels } from "@/lib/demo-data";
import { runTransitions, validateRefund } from "@/lib/workflow";
import type { AppState, Campaign, Feedback, Participation, ParticipationStatus, Role } from "@/types";

type ConsumerTab = "discover" | "mine" | "notifications";
type MerchantTab = "dashboard" | "applications" | "feedback" | "events";
type AdminTab = "exceptions" | "events";

const storageKey = "xinpin-trial-mvp-state-v1";
const currentUser = "demo-user";

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
const money = (value: number) => `¥${value.toFixed(2)}`;

function ProductVisual({ campaign, compact = false }: { campaign: Campaign; compact?: boolean }) {
  return (
    <div className={`product-visual ${campaign.category} ${compact ? "compact" : ""}`} style={{ "--accent": campaign.accent } as React.CSSProperties}>
      <div className="art-orbit" />
      <div className="art-shadow" />
      {campaign.category === "bakery" && <div className="cake-box"><span>鲜奶</span><i /><i /><i /></div>}
      {campaign.category === "tea" && <div className="tea-bottle"><span>桂花<br />乌龙</span><i /></div>}
      {campaign.category === "snack" && <div className="snack-bag"><span>海风<br /><b>脆</b></span><i /></div>}
      {!compact && <small>{campaign.brand} · NEW SAMPLE</small>}
    </div>
  );
}

function Logo() {
  return (
    <div className="brand-mark" aria-label="新品试用">
      <span><Leaf size={18} strokeWidth={2.5} /></span>
      <b>新品试用</b>
    </div>
  );
}

function StatusPill({ status }: { status: ParticipationStatus }) {
  return <span className={`status-pill status-${status}`}>{statusLabels[status]}</span>;
}

function Toast({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 2800);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return <div className="toast"><CheckCircle2 size={18} />{children}</div>;
}

function ScorePicker({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <fieldset className="score-field">
      <legend>{label}</legend>
      <div className="score-options">
        {[1, 2, 3, 4, 5].map((score) => (
          <button key={score} type="button" onClick={() => onChange(score)} className={value >= score ? "active" : ""} aria-label={`${label} ${score} 分`}>
            <Star size={24} fill={value >= score ? "currentColor" : "none"} />
          </button>
        ))}
        <span>{value ? `${value}.0` : "请选择"}</span>
      </div>
    </fieldset>
  );
}

const journey = [
  { key: "application", label: "申请", statuses: ["under_review", "approved", "purchase_pending", "purchased", "shipment_pending", "shipped", "delivered", "feedback_available", "feedback_submitted", "feedback_revision_required", "feedback_resubmitted", "feedback_approved", "refund_pending", "refund_processing", "refund_success", "completed"] },
  { key: "qualification", label: "资格", statuses: ["purchase_pending", "purchased", "shipment_pending", "shipped", "delivered", "feedback_available", "feedback_submitted", "feedback_revision_required", "feedback_resubmitted", "feedback_approved", "refund_pending", "refund_processing", "refund_success", "completed"] },
  { key: "purchase", label: "购买", statuses: ["purchased", "shipment_pending", "shipped", "delivered", "feedback_available", "feedback_submitted", "feedback_revision_required", "feedback_resubmitted", "feedback_approved", "refund_pending", "refund_processing", "refund_success", "completed"] },
  { key: "delivery", label: "签收", statuses: ["delivered", "feedback_available", "feedback_submitted", "feedback_revision_required", "feedback_resubmitted", "feedback_approved", "refund_pending", "refund_processing", "refund_success", "completed"] },
  { key: "feedback", label: "反馈", statuses: ["feedback_submitted", "feedback_resubmitted", "feedback_approved", "refund_pending", "refund_processing", "refund_success", "completed"] },
  { key: "refund", label: "返款", statuses: ["refund_success", "completed"] },
];

function ProgressRail({ status }: { status: ParticipationStatus }) {
  const currentIndex = journey.findIndex((item) => !item.statuses.includes(status));
  return (
    <div className="progress-rail" aria-label={`当前状态：${statusLabels[status]}`}>
      {journey.map((item, index) => {
        const done = item.statuses.includes(status);
        const current = !done && (currentIndex === index || (status === "feedback_available" && item.key === "feedback") || (status.startsWith("refund_") && item.key === "refund"));
        return (
          <div className={`rail-step ${done ? "done" : ""} ${current ? "current" : ""}`} key={item.key}>
            <span>{done ? <Check size={13} /> : index + 1}</span>
            <small>{item.label}</small>
          </div>
        );
      })}
    </div>
  );
}

function RoleSwitch({ role, setRole }: { role: Role; setRole: (role: Role) => void }) {
  return (
    <div className="role-switch" aria-label="切换演示角色">
      <button className={role === "consumer" ? "active" : ""} onClick={() => setRole("consumer")}>消费者</button>
      <button className={role === "merchant" ? "active" : ""} onClick={() => setRole("merchant")}>商家</button>
      <button className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")}>平台</button>
    </div>
  );
}

export function TrialApp() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState<Role>("consumer");
  const [consumerTab, setConsumerTab] = useState<ConsumerTab>("discover");
  const [merchantTab, setMerchantTab] = useState<MerchantTab>("dashboard");
  const [adminTab, setAdminTab] = useState<AdminTab>("exceptions");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [applying, setApplying] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<Participation | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setState(JSON.parse(saved) as AppState);
    } catch { /* keep the seeded demo */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, hydrated]);

  const myParticipations = useMemo(() => state.participations.filter((item) => item.userId === currentUser), [state.participations]);
  const pendingApplications = state.participations.filter((item) => item.status === "under_review");
  const pendingFeedback = state.participations.filter((item) => ["feedback_submitted", "feedback_resubmitted"].includes(item.status));
  const exceptions = state.participations.filter((item) => item.status === "refund_failed");

  const notify = (message: string) => setToast(message);

  const replaceParticipation = (updated: Participation, events = state.events) => {
    setState((current) => ({ ...current, participations: current.participations.map((item) => item.id === updated.id ? updated : item), events }));
  };

  const advance = (
    target: Participation,
    steps: Parameters<typeof runTransitions>[1],
    patch?: Partial<Participation>,
    notification?: { title: string; body: string },
  ) => {
    try {
      const result = runTransitions(target, steps);
      setState((current) => ({
        ...current,
        participations: current.participations.map((item) => item.id === target.id ? { ...result.participation, ...patch } : item),
        events: [...result.events, ...current.events],
        notifications: notification ? [{ id: uid("notification"), ...notification, read: false, createdAt: "刚刚" }, ...current.notifications] : current.notifications,
      }));
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "状态更新失败");
      return false;
    }
  };

  const submitApplication = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCampaign) return;
    if (state.participations.some((item) => item.campaignId === selectedCampaign.id && item.userId === currentUser)) {
      notify("这个活动已经申请过了，可在「我的试用」查看进度");
      return;
    }
    const data = new FormData(event.currentTarget);
    const base: Participation = {
      id: uid("participation"),
      campaignId: selectedCampaign.id,
      userId: currentUser,
      userName: String(data.get("nickname") || "林小雨"),
      city: String(data.get("city") || "杭州"),
      age: String(data.get("age") || "25-34"),
      reason: String(data.get("reason") || ""),
      status: "applied",
      submittedAt: new Date().toISOString(),
    };
    const result = runTransitions(base, [{ to: "under_review", event: "trial_application_submitted", actor: "consumer", name: base.userName }]);
    setState((current) => ({ ...current, participations: [result.participation, ...current.participations], events: [...result.events, ...current.events] }));
    setApplying(false);
    setSelectedCampaign(null);
    setConsumerTab("mine");
    notify("申请已提交，商家审核结果会在这里显示");
  };

  const approveApplication = (item: Participation) => {
    const token = `QT-${item.campaignId.slice(0, 4).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
    if (advance(item, [
      { to: "approved", event: "trial_application_approved", actor: "merchant", name: "尖锋食客" },
      { to: "purchase_pending", event: "qualification_issued", actor: "system", name: "工作流引擎", metadata: token },
    ], { qualificationToken: token, purchaseExpiresAt: new Date(Date.now() + 48 * 3600_000).toISOString() }, { title: "试用申请通过", body: "你已获得专属购买资格，请在 48 小时内完成购买。" })) notify("审核通过，专属购买资格已自动发放");
  };

  const rejectApplication = (item: Participation) => {
    if (advance(item, [{ to: "rejected", event: "trial_application_rejected", actor: "merchant", name: "尖锋食客" }])) notify("已拒绝这份申请");
  };

  const simulateOrder = (item: Participation) => {
    const stepsByStatus: Partial<Record<ParticipationStatus, Parameters<typeof runTransitions>[1]>> = {
      purchase_pending: [
        { to: "purchased", event: "order_paid", actor: "system", name: "MockOrderAdapter" },
        { to: "shipment_pending", event: "shipment_pending", actor: "system", name: "工作流引擎" },
      ],
      shipment_pending: [{ to: "shipped", event: "order_shipped", actor: "merchant", name: "尖锋食客" }],
      shipped: [
        { to: "delivered", event: "shipment_delivered", actor: "system", name: "物流回调" },
        { to: "feedback_available", event: "feedback_task_opened", actor: "system", name: "工作流引擎" },
      ],
    };
    const steps = stepsByStatus[item.status];
    if (!steps) return;
    const patch = item.status === "shipment_pending"
      ? { trackingNumber: `SF${Date.now().toString().slice(-12)}` }
      : item.status === "shipped"
        ? { feedbackDeadline: new Date(Date.now() + 7 * 86400_000).toISOString() }
        : undefined;
    if (advance(item, steps, patch, item.status === "shipped" ? { title: "反馈任务已开启", body: "商品已签收，请在 7 天内完成试用反馈。" } : undefined)) notify(item.status === "purchase_pending" ? "已模拟付款，订单进入待发货" : item.status === "shipment_pending" ? "已模拟发货" : "已模拟签收，反馈任务自动开启");
  };

  const submitFeedback = (participation: Participation, feedback: Feedback) => {
    const isRevision = participation.status === "feedback_revision_required";
    if (advance(participation, [{
      to: isRevision ? "feedback_resubmitted" : "feedback_submitted",
      event: isRevision ? "feedback_resubmitted" : "feedback_submitted",
      actor: "consumer",
      name: participation.userName,
    }], { feedback, revisionReason: undefined })) {
      setFeedbackTarget(null);
      notify("反馈已提交，审核通过后将进入退款流程");
    }
  };

  const requestRevision = (item: Participation) => {
    if (advance(item, [{ to: "feedback_revision_required", event: "feedback_revision_requested", actor: "merchant", name: "尖锋食客", metadata: "请补充一张商品开封后的照片" }], { revisionReason: "请补充一张商品开封后的照片" }, { title: "反馈需要补充", body: "请补充一张商品开封后的照片后重新提交。" })) notify("已退回补充，并通知消费者");
  };

  const approveFeedback = (item: Participation) => {
    const campaign = campaigns.find((campaignItem) => campaignItem.id === item.campaignId)!;
    const error = validateRefund({ ...item, status: "feedback_approved" }, campaign.refundAmount, campaign.refundAmount);
    if (error) return notify(error);
    const idempotency = item.refundIdempotencyKey || `refund-${item.id}`;
    if (advance(item, [
      { to: "feedback_approved", event: "feedback_approved", actor: "merchant", name: "尖锋食客" },
      { to: "refund_pending", event: "refund_requested", actor: "system", name: "RefundService", metadata: idempotency },
    ], { refundIdempotencyKey: idempotency }, { title: "反馈审核通过", body: `${money(campaign.refundAmount)} 已进入原路退款流程。` })) notify("反馈已通过，退款请求已安全创建");
  };

  const finishRefund = (item: Participation) => {
    if (advance(item, [
      { to: "refund_processing", event: "refund_processing", actor: "system", name: "MockOrderAdapter" },
      { to: "refund_success", event: "refund_success", actor: "system", name: "MockOrderAdapter" },
      { to: "completed", event: "trial_completed", actor: "system", name: "工作流引擎" },
    ], undefined, { title: "退款已到账", body: "试用款已原路退回，感谢你的真实反馈。" })) notify("退款成功，试用流程已完成");
  };

  const resolveException = (item: Participation) => {
    const campaign = campaigns.find((entry) => entry.id === item.campaignId)!;
    const error = validateRefund(item, campaign.refundAmount, campaign.refundAmount);
    if (error) return notify(error);
    if (advance(item, [
      { to: "refund_pending", event: "manual_refund_approved", actor: "admin", name: "平台管理员" },
      { to: "refund_processing", event: "refund_processing", actor: "system", name: "人工退款通道" },
      { to: "refund_success", event: "refund_success", actor: "admin", name: "平台管理员" },
      { to: "completed", event: "trial_completed", actor: "system", name: "工作流引擎" },
    ], { refundFailureReason: undefined }, { title: "退款异常已处理", body: `${money(campaign.refundAmount)} 已由平台核对并原路退回。` })) notify("异常已人工核对并完成，审计日志已记录");
  };

  const resetDemo = () => {
    setState(initialState);
    window.localStorage.removeItem(storageKey);
    notify("演示数据已重置");
  };

  return (
    <div className={`app-shell role-${role}`}>
      {role === "consumer" ? (
        <>
          <ConsumerHeader role={role} setRole={setRole} unread={state.notifications.filter((item) => !item.read).length} onNotice={() => setConsumerTab("notifications")} />
          <main className="consumer-main">
            {selectedCampaign ? (
              <CampaignDetail campaign={selectedCampaign} onBack={() => setSelectedCampaign(null)} onApply={() => setApplying(true)} alreadyApplied={state.participations.some((item) => item.userId === currentUser && item.campaignId === selectedCampaign.id)} />
            ) : consumerTab === "discover" ? (
              <Discover campaigns={campaigns} onSelect={setSelectedCampaign} />
            ) : consumerTab === "mine" ? (
              <MyTrials participations={myParticipations} onFeedback={setFeedbackTarget} />
            ) : (
              <Notifications state={state} setState={setState} />
            )}
          </main>
          {!selectedCampaign && <ConsumerNav tab={consumerTab} onChange={setConsumerTab} unread={state.notifications.filter((item) => !item.read).length} />}
          {applying && selectedCampaign && <ApplicationDialog campaign={selectedCampaign} onClose={() => setApplying(false)} onSubmit={submitApplication} />}
          {feedbackTarget && <FeedbackDialog participation={feedbackTarget} campaign={campaigns.find((item) => item.id === feedbackTarget.campaignId)!} onClose={() => setFeedbackTarget(null)} onSubmit={submitFeedback} />}
        </>
      ) : (
        <BackofficeShell role={role} setRole={setRole} onReset={resetDemo}>
          {role === "merchant" ? (
            <MerchantWorkspace
              tab={merchantTab}
              onTab={setMerchantTab}
              state={state}
              pendingApplications={pendingApplications}
              pendingFeedback={pendingFeedback}
              exceptions={exceptions}
              onApprove={approveApplication}
              onReject={rejectApplication}
              onSimulate={simulateOrder}
              onRevision={requestRevision}
              onApproveFeedback={approveFeedback}
              onRefund={finishRefund}
            />
          ) : (
            <AdminWorkspace tab={adminTab} onTab={setAdminTab} state={state} exceptions={exceptions} onResolve={resolveException} />
          )}
        </BackofficeShell>
      )}
      {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
    </div>
  );
}

function ConsumerHeader({ role, setRole, unread, onNotice }: { role: Role; setRole: (role: Role) => void; unread: number; onNotice: () => void }) {
  return (
    <header className="consumer-header page-width">
      <Logo />
      <div className="header-actions">
        <RoleSwitch role={role} setRole={setRole} />
        <button className="icon-button notification-button" onClick={onNotice} aria-label="通知"><Bell size={20} />{unread > 0 && <i>{unread}</i>}</button>
        <button className="avatar-button" aria-label="个人中心">雨</button>
      </div>
    </header>
  );
}

function Discover({ campaigns: items, onSelect }: { campaigns: Campaign[]; onSelect: (campaign: Campaign) => void }) {
  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> NEW / 08.24</span>
          <h1>先认真试用，<br /><em>再认真说。</em></h1>
          <p>品牌把还没定型的新品交给你。你先正常购买，按规则完成真实反馈，审核通过后返还试用款。</p>
          <button className="primary-button" onClick={() => document.getElementById("campaigns")?.scrollIntoView({ behavior: "smooth" })}>看看本期新品 <ArrowRight size={18} /></button>
        </div>
        <div className="hero-ticket" aria-label="试用流程凭证">
          <div className="ticket-top"><span>TRIAL PASS</span><b>NO. 0824</b></div>
          <div className="ticket-core">
            <small>这不是“免费白拿”</small>
            <strong>一份商品<br />换一份真话</strong>
            <div className="ticket-route"><span>付款</span><i /><span>试用</span><i /><span>反馈</span><i /><span>返款</span></div>
          </div>
          <div className="ticket-foot"><ShieldCheck size={18} /><span>规则透明 · 状态可查 · 原路退款</span></div>
        </div>
      </section>
      <section className="trust-band">
        <div className="page-width">
          <span><BadgeCheck size={19} />每个名额对应专属资格</span>
          <span><PackageCheck size={19} />签收后才开始计算反馈期</span>
          <span><WalletCards size={19} />审核通过，试用款原路退回</span>
        </div>
      </section>
      <section className="campaign-section page-width" id="campaigns">
        <div className="section-heading">
          <div><span className="eyebrow">本期开放申请</span><h2>正在找首批体验官</h2></div>
          <p>不看粉丝数，只看你是不是合适的人。</p>
        </div>
        <div className="campaign-grid">
          {items.map((campaign, index) => (
            <article className="campaign-card" key={campaign.id} onClick={() => onSelect(campaign)}>
              <ProductVisual campaign={campaign} />
              <div className="card-body">
                <div className="card-meta"><span>{campaign.brand}</span><small>{index === 0 ? "3 天后截止" : campaign.deadline}</small></div>
                <h3>{campaign.title}</h3>
                <p>{campaign.subtitle}</p>
                <div className="refund-line"><small>完成反馈后预计返还</small><strong>{money(campaign.refundAmount)}</strong></div>
                <div className="card-progress"><i style={{ width: `${Math.min(92, campaign.applications / campaign.quota * 40)}%` }} /><span>{campaign.quota} 份 · {campaign.applications.toLocaleString()} 人申请</span></div>
                <button>查看试用规则 <ChevronRight size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="how-it-works page-width">
        <div><span className="eyebrow">一次完整试用</span><h2>你会清楚知道，<br />自己走到了哪一步。</h2></div>
        <div className="process-list">
          {["提交申请，等待品牌审核", "获得专属资格，正常付款购买", "签收后完成结构化真实反馈", "反馈通过，试用款原路退回"].map((text, index) => <div key={text}><span>0{index + 1}</span><p>{text}</p></div>)}
        </div>
      </section>
    </>
  );
}

function CampaignDetail({ campaign, onBack, onApply, alreadyApplied }: { campaign: Campaign; onBack: () => void; onApply: () => void; alreadyApplied: boolean }) {
  const flow = ["申请", "资格", "付款", "签收", "试用", "反馈", "审核", "返款"];
  return (
    <div className="detail-page page-width">
      <button className="back-button" onClick={onBack}><ArrowLeft size={18} /> 返回全部试用</button>
      <div className="detail-hero">
        <ProductVisual campaign={campaign} />
        <div className="detail-copy">
          <span className="brand-kicker">{campaign.brand} · 新品首发</span>
          <h1>{campaign.title}</h1>
          <p>{campaign.subtitle}</p>
          <div className="price-block"><span>商品价格 <b>{money(campaign.price)}</b></span><i /><span>预计返还 <strong>{money(campaign.refundAmount)}</strong></span></div>
          <div className="clarity-note"><ShieldCheck size={21} /><p><b>先付款试用</b>完成规定反馈并经审核通过后，返还对应试用款。</p></div>
          <button className="primary-button wide" onClick={onApply} disabled={alreadyApplied}>{alreadyApplied ? "已申请，可在我的试用查看" : "申请试用"}<ArrowRight size={18} /></button>
          <small className="deadline-note"><Clock3 size={14} />申请截止：{campaign.deadline} · 共 {campaign.quota} 个名额</small>
        </div>
      </div>
      <div className="rule-layout">
        <section className="rule-main">
          <span className="eyebrow">申请前，请先看清楚</span><h2>一份试用，要走完这 8 步</h2>
          <div className="flow-strip">{flow.map((item, index) => <div key={item}><span>{index + 1}</span><b>{item}</b>{index < flow.length - 1 && <i />}</div>)}</div>
          <h3>什么样的反馈算合格？</h3>
          <ul className="requirement-list">{campaign.requirements.map((item) => <li key={item}><CheckCircle2 size={19} />{item}</li>)}</ul>
          <div className="plain-rules">
            <div><b>反馈期限</b><p>从物流签收时开始计算，共 {campaign.feedbackDays} 天。逾期将失去返款资格。</p></div>
            <div><b>审核时间</b><p>品牌通常会在提交后的 1–3 个工作日内完成审核；如需补充，会明确说明原因。</p></div>
            <div><b>退款规则</b><p>仅在有效订单已付款、反馈审核通过后发起；最高不超过 {money(campaign.refundAmount)}，原路退回。</p></div>
          </div>
        </section>
        <aside className="rule-aside"><ShieldCheck size={26} /><h3>你的每一步都有记录</h3><p>申请、资格、订单、物流、反馈和退款都进入同一条流程轨道。若有争议，可回看完整时间线。</p><span>专属资格不可转让</span></aside>
      </div>
    </div>
  );
}

function ApplicationDialog({ campaign, onClose, onSubmit }: { campaign: Campaign; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog application-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-title">
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <span className="eyebrow">申请试用 · 约 2 分钟</span><h2 id="apply-title">让品牌知道为什么是你</h2><p className="dialog-intro">{campaign.title}</p>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <label>昵称<input name="nickname" required defaultValue="林小雨" /></label>
            <label>手机号<input name="phone" required inputMode="tel" placeholder="仅用于试用通知" pattern="[0-9]{11}" /></label>
            <label>年龄段<select name="age" defaultValue="25-34"><option>18-24</option><option>25-34</option><option>35-44</option><option>45-54</option><option>55+</option></select></label>
            <label>所在城市<input name="city" required defaultValue="杭州" /></label>
          </div>
          <label>是否买过类似产品？<select name="similar" defaultValue="偶尔购买"><option>经常购买</option><option>偶尔购买</option><option>从未购买</option></select></label>
          <label>为什么想参加这次试用？<textarea name="reason" required minLength={20} placeholder="请具体说说你的使用场景或对这类产品的了解（至少 20 字）" /></label>
          <label className="check-label"><input type="checkbox" required /><span>我已阅读并同意试用规则，理解需要先付款、按期反馈，审核通过后返还试用款。</span></label>
          <button className="primary-button wide" type="submit">确认提交申请 <ArrowRight size={18} /></button>
        </form>
      </div>
    </div>
  );
}

function MyTrials({ participations, onFeedback }: { participations: Participation[]; onFeedback: (item: Participation) => void }) {
  return (
    <section className="my-page page-width">
      <div className="my-heading"><div><span className="eyebrow">MY TRIALS</span><h1>我的试用</h1><p>下一步该做什么，这里会直接告诉你。</p></div><div className="completion-score"><span>守约完成率</span><strong>100%</strong><small>已完成 6 次</small></div></div>
      <div className="filter-tabs"><button className="active">全部</button><button>进行中</button><button>待反馈</button><button>退款中</button><button>已完成</button></div>
      <div className="my-list">
        {participations.length === 0 && <div className="empty-state"><Inbox size={32} /><h3>还没有申请记录</h3><p>去看看正在招募的新品。</p></div>}
        {participations.map((item) => {
          const campaign = campaigns.find((entry) => entry.id === item.campaignId)!;
          const canFeedback = ["feedback_available", "feedback_revision_required"].includes(item.status);
          return (
            <article className="my-trial-card" key={item.id}>
              <ProductVisual campaign={campaign} compact />
              <div className="my-trial-content">
                <div className="my-trial-top"><div><small>{campaign.brand}</small><h3>{campaign.title}</h3></div><StatusPill status={item.status} /></div>
                <ProgressRail status={item.status} />
                <div className={`next-action ${item.status === "feedback_revision_required" ? "warning" : ""}`}>
                  <div>
                    <small>当前下一步</small>
                    <b>{nextActionText(item.status)}</b>
                    {item.status === "feedback_available" && <span>剩余 5 天 · 08月29日 23:00 前</span>}
                    {item.revisionReason && <span>{item.revisionReason}</span>}
                    {item.status === "completed" && <span>{money(campaign.refundAmount)} 已原路退回</span>}
                  </div>
                  {canFeedback && <button className="primary-button small" onClick={() => onFeedback(item)}>{item.status === "feedback_revision_required" ? "修改反馈" : "去提交反馈"}<ArrowRight size={16} /></button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function nextActionText(status: ParticipationStatus) {
  const map: Partial<Record<ParticipationStatus, string>> = {
    under_review: "等待品牌审核",
    purchase_pending: "请在 48 小时内完成购买",
    shipment_pending: "等待品牌发货",
    shipped: "商品运输中",
    feedback_available: "开始真实试用并提交反馈",
    feedback_submitted: "等待品牌审核反馈",
    feedback_revision_required: "按说明补充反馈",
    feedback_resubmitted: "等待品牌再次审核",
    refund_pending: "等待系统发起退款",
    refund_processing: "试用款正在原路退回",
    completed: "本次试用已完成",
    rejected: "本次申请未通过",
  };
  return map[status] || statusLabels[status];
}

function FeedbackDialog({ participation, campaign, onClose, onSubmit }: { participation: Participation; campaign: Campaign; onClose: () => void; onSubmit: (item: Participation, feedback: Feedback) => void }) {
  const previous = participation.feedback;
  const [scores, setScores] = useState({ overall: previous?.overall || 0, taste: previous?.taste || 0, packaging: previous?.packaging || 0, value: previous?.value || 0 });
  const [repurchase, setRepurchase] = useState<Feedback["repurchase"]>(previous?.repurchase || "可能会");
  const [photos, setPhotos] = useState(previous?.photos || 0);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (Object.values(scores).some((score) => score === 0)) return;
    onSubmit(participation, { ...scores, repurchase, liked: String(data.get("liked")), improve: String(data.get("improve")), review: String(data.get("review")), photos });
  };
  return (
    <div className="dialog-backdrop feedback-backdrop">
      <div className="dialog feedback-dialog" role="dialog" aria-modal="true">
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <div className="feedback-heading"><ProductVisual campaign={campaign} compact /><div><span className="eyebrow">真实试用反馈</span><h2>{campaign.title}</h2><p>没有标准答案，具体比好听更重要。</p></div></div>
        {participation.revisionReason && <div className="revision-banner"><AlertCircle size={20} /><div><b>这份反馈需要补充</b><p>{participation.revisionReason}</p></div></div>}
        <form onSubmit={handleSubmit}>
          <div className="score-grid">
            <ScorePicker label="整体满意度" value={scores.overall} onChange={(overall) => setScores({ ...scores, overall })} />
            <ScorePicker label="口味满意度" value={scores.taste} onChange={(taste) => setScores({ ...scores, taste })} />
            <ScorePicker label="包装体验" value={scores.packaging} onChange={(packaging) => setScores({ ...scores, packaging })} />
            <ScorePicker label="性价比" value={scores.value} onChange={(value) => setScores({ ...scores, value })} />
          </div>
          <fieldset className="repurchase-field"><legend>你愿意再次购买吗？</legend><div>{(["会", "可能会", "不会"] as const).map((item) => <button type="button" className={repurchase === item ? "active" : ""} onClick={() => setRepurchase(item)} key={item}>{item}</button>)}</div></fieldset>
          <label>最喜欢什么？<textarea name="liked" required defaultValue={previous?.liked} placeholder="具体到一个口感、细节或使用时刻" /></label>
          <label>哪些地方需要改进？<textarea name="improve" required defaultValue={previous?.improve} placeholder="直接说最希望品牌改的一点" /></label>
          <label>真实试用感受<textarea name="review" required minLength={50} defaultValue={previous?.review} placeholder="至少 50 字。可以说场景、第一口感受、和同类产品的差别……" /></label>
          <div className="photo-upload">
            <div><b>真实试用图片</b><span>jpg / png / webp，1–3 张</span></div>
            <button type="button" onClick={() => setPhotos(Math.min(3, photos + 1))}>{photos ? `已选择 ${photos} 张 · 继续添加` : "+ 选择图片（演示）"}</button>
          </div>
          <div className="submit-note"><ShieldCheck size={19} /><p>提交后商家将审核；审核通过后，系统才会进入退款流程。</p></div>
          <button className="primary-button wide" disabled={!photos || Object.values(scores).some((score) => score === 0)}>提交真实反馈 <ArrowRight size={18} /></button>
        </form>
      </div>
    </div>
  );
}

function Notifications({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const markAllRead = () => setState((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, read: true })) }));
  return (
    <section className="notification-page page-width"><div className="section-heading"><div><span className="eyebrow">MESSAGES</span><h1>通知</h1></div><button className="text-button" onClick={markAllRead}>全部标为已读</button></div><div className="notification-list">{state.notifications.map((item) => <article key={item.id} className={!item.read ? "unread" : ""}><span><Bell size={18} /></span><div><h3>{item.title}</h3><p>{item.body}</p><small>{item.createdAt}</small></div>{!item.read && <i />}</article>)}</div></section>
  );
}

function ConsumerNav({ tab, onChange, unread }: { tab: ConsumerTab; onChange: (tab: ConsumerTab) => void; unread: number }) {
  return <nav className="consumer-nav"><button className={tab === "discover" ? "active" : ""} onClick={() => onChange("discover")}><House /><span>发现</span></button><button className={tab === "mine" ? "active" : ""} onClick={() => onChange("mine")}><ShoppingBag /><span>我的试用</span></button><button className={tab === "notifications" ? "active" : ""} onClick={() => onChange("notifications")}><Bell /><span>通知</span>{unread > 0 && <i>{unread}</i>}</button></nav>;
}

function BackofficeShell({ role, setRole, onReset, children }: { role: Role; setRole: (role: Role) => void; onReset: () => void; children: ReactNode }) {
  return (
    <div className="backoffice">
      <header className="backoffice-mobile-head"><Logo /><RoleSwitch role={role} setRole={setRole} /></header>
      <aside className="backoffice-sidebar"><Logo /><div className="merchant-identity"><span>{role === "merchant" ? "尖" : "管"}</span><div><b>{role === "merchant" ? "尖锋食客" : "平台管理中心"}</b><small>{role === "merchant" ? "品牌商家" : "ADMIN"}</small></div></div><div className="sidebar-foot"><RoleSwitch role={role} setRole={setRole} /><button onClick={onReset}><RotateCcw size={16} />重置演示数据</button><button><LogOut size={16} />退出演示</button></div></aside>
      <main className="backoffice-main">{children}</main>
    </div>
  );
}

interface MerchantProps {
  tab: MerchantTab;
  onTab: (tab: MerchantTab) => void;
  state: AppState;
  pendingApplications: Participation[];
  pendingFeedback: Participation[];
  exceptions: Participation[];
  onApprove: (item: Participation) => void;
  onReject: (item: Participation) => void;
  onSimulate: (item: Participation) => void;
  onRevision: (item: Participation) => void;
  onApproveFeedback: (item: Participation) => void;
  onRefund: (item: Participation) => void;
}

function MerchantWorkspace(props: MerchantProps) {
  const nav = [{ id: "dashboard", label: "经营总览", icon: LayoutDashboard }, { id: "applications", label: "申请审核", icon: UsersRound, count: props.pendingApplications.length }, { id: "feedback", label: "反馈与退款", icon: ClipboardCheck, count: props.pendingFeedback.length }, { id: "events", label: "流程日志", icon: FileText }];
  const activeOrders = props.state.participations.filter((item) => ["purchase_pending", "purchased", "shipment_pending", "shipped"].includes(item.status));
  return (
    <>
      <nav className="backoffice-nav">{nav.map((item) => <button key={item.id} className={props.tab === item.id ? "active" : ""} onClick={() => props.onTab(item.id as MerchantTab)}><item.icon size={18} />{item.label}{item.count ? <i>{item.count}</i> : null}</button>)}</nav>
      <div className="workspace-content">
        {props.tab === "dashboard" && <MerchantDashboard state={props.state} applications={props.pendingApplications} feedback={props.pendingFeedback} exceptions={props.exceptions} onGo={props.onTab} activeOrders={activeOrders} onSimulate={props.onSimulate} />}
        {props.tab === "applications" && <ApplicationReview items={props.pendingApplications} onApprove={props.onApprove} onReject={props.onReject} />}
        {props.tab === "feedback" && <FeedbackReview state={props.state} pending={props.pendingFeedback} onRevision={props.onRevision} onApprove={props.onApproveFeedback} onRefund={props.onRefund} />}
        {props.tab === "events" && <EventLog events={props.state.events} />}
      </div>
    </>
  );
}

function WorkspaceHeading({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return <div className="workspace-heading"><div><span>{kicker}</span><h1>{title}</h1><p>2026年08月24日 · 所有数字均为演示数据</p></div>{children}</div>;
}

function MerchantDashboard({ state, applications, feedback, exceptions, onGo, activeOrders, onSimulate }: { state: AppState; applications: Participation[]; feedback: Participation[]; exceptions: Participation[]; onGo: (tab: MerchantTab) => void; activeOrders: Participation[]; onSimulate: (item: Participation) => void }) {
  const completed = state.participations.filter((item) => item.status === "completed").length;
  return (
    <>
      <WorkspaceHeading kicker="MERCHANT WORKSPACE" title="早上好，今天先处理这三件事"><button className="outline-button"><span>+</span> 创建试用活动</button></WorkspaceHeading>
      <section className="todo-board">
        <div className="todo-intro"><span><Gauge /></span><div><small>今日待办</small><strong>{applications.length + feedback.length + exceptions.length}</strong><p>每处理一项，流程会自动向前走。</p></div></div>
        <button onClick={() => onGo("applications")}><span className="todo-icon coral"><UsersRound /></span><div><b>{applications.length}</b><p>份申请待审核</p></div><ChevronRight /></button>
        <button onClick={() => onGo("feedback")}><span className="todo-icon green"><ClipboardCheck /></span><div><b>{feedback.length}</b><p>份反馈待审核</p></div><ChevronRight /></button>
        <button><span className="todo-icon amber"><AlertCircle /></span><div><b>{exceptions.length}</b><p>个退款异常</p></div><ChevronRight /></button>
      </section>
      <section className="metric-grid">
        {[{ label: "进行中的活动", value: 3, note: "1 个本周截止" }, { label: "今日新申请", value: 82, note: "较昨日 +14%" }, { label: "已发放资格", value: 500, note: "购买率 92.6%" }, { label: "已完成试用", value: 410 + completed, note: "反馈合格率 96.7%" }].map((item) => <article key={item.label}><small>{item.label}</small><strong>{item.value}</strong><span>{item.note}</span></article>)}
      </section>
      <div className="dashboard-columns">
        <section className="panel funnel-panel"><div className="panel-heading"><div><small>鲜奶小蛋糕新品试吃</small><h2>活动转化漏斗</h2></div><button>查看活动 <ArrowRight size={16} /></button></div><div className="funnel-bars">{[{ name: "浏览", value: 2183, rate: 100 }, { name: "申请", value: 1268, rate: 58 }, { name: "通过", value: 500, rate: 40 }, { name: "购买", value: 463, rate: 37 }, { name: "签收", value: 451, rate: 36 }, { name: "反馈合格", value: 413, rate: 33 }, { name: "退款成功", value: 410, rate: 32 }].map((item) => <div key={item.name}><span>{item.name}</span><i><b style={{ width: `${item.rate}%` }} /></i><strong>{item.value.toLocaleString()}</strong></div>)}</div></section>
        <section className="panel activity-panel"><div className="panel-heading"><div><small>MOCK ORDER ADAPTER</small><h2>订单流程演示</h2></div></div>{activeOrders.length ? activeOrders.slice(0, 4).map((item) => { const campaign = campaigns.find((entry) => entry.id === item.campaignId)!; return <div className="adapter-row" key={item.id}><ProductVisual campaign={campaign} compact /><div><b>{item.userName} · {campaign.title}</b><StatusPill status={item.status} /></div><button onClick={() => onSimulate(item)}>{item.status === "purchase_pending" ? "模拟付款" : item.status === "shipment_pending" ? "模拟发货" : "模拟签收"}<ChevronRight size={15} /></button></div> }) : <div className="empty-state small"><PackageCheck /><p>暂无待推进的模拟订单</p></div>}</section>
      </div>
    </>
  );
}

function ApplicationReview({ items, onApprove, onReject }: { items: Participation[]; onApprove: (item: Participation) => void; onReject: (item: Participation) => void }) {
  return (
    <><WorkspaceHeading kicker="APPLICATION REVIEW" title="申请审核"><div className="search-box"><Search size={17} /><input placeholder="搜索用户或城市" /></div></WorkspaceHeading><section className="panel table-panel"><div className="table-toolbar"><div><button className="active">待审核 {items.length}</button><button>已通过</button><button>已拒绝</button></div><button className="outline-button small">批量操作</button></div>{items.length ? <div className="application-table"><div className="table-head"><span>用户</span><span>申请理由</span><span>历史表现</span><span>申请时间</span><span>操作</span></div>{items.map((item) => <div className="table-row" key={item.id}><div className="user-cell"><span>{item.userName.slice(0, 1)}</span><div><b>{item.userName}</b><small>{item.city} · {item.age}</small></div></div><p>{item.reason}</p><div className="history-cell"><b>{item.userId.includes("zhou") ? "4 / 4" : "6 / 6"}</b><small>参与 / 完成</small><i><b style={{ width: "100%" }} /></i></div><div><b>今天</b><small>{item.id.includes("zhou") ? "09:42" : "10:16"}</small></div><div className="row-actions"><button className="reject-button" onClick={() => onReject(item)}>拒绝</button><button className="approve-button" onClick={() => onApprove(item)}>通过</button></div></div>)}</div> : <div className="empty-state"><CheckCircle2 /><h3>申请已全部处理</h3><p>新的申请会自动出现在这里。</p></div>}</section></>
  );
}

function FeedbackReview({ state, pending, onRevision, onApprove, onRefund }: { state: AppState; pending: Participation[]; onRevision: (item: Participation) => void; onApprove: (item: Participation) => void; onRefund: (item: Participation) => void }) {
  const refunds = state.participations.filter((item) => item.status === "refund_pending");
  return (
    <><WorkspaceHeading kicker="FEEDBACK & REFUND" title="反馈与退款" /><div className="feedback-workspace"><section className="panel"><div className="panel-heading"><div><small>WAITING FOR REVIEW</small><h2>待审核反馈 · {pending.length}</h2></div></div>{pending.length ? pending.map((item) => { const campaign = campaigns.find((entry) => entry.id === item.campaignId)!; return <article className="feedback-review-card" key={item.id}><div className="feedback-person"><ProductVisual campaign={campaign} compact /><div><b>{item.userName}</b><small>{campaign.title}</small></div><div className="review-score"><Star fill="currentColor" />{item.feedback?.overall || 4}.0</div></div><div className="feedback-excerpt"><b>真实试用感受</b><p>{item.feedback?.review || "反馈内容已提交，等待审核。"}</p><span>{item.feedback?.photos || 1} 张图片 · 提交于今天 11:20</span></div><div className="review-actions"><button className="reject-button" onClick={() => onRevision(item)}><RefreshCcw size={15} />需要补充</button><button className="approve-button" onClick={() => onApprove(item)}><Check size={15} />审核通过并创建退款</button></div></article> }) : <div className="empty-state small"><CheckCircle2 /><p>暂无待审核反馈</p></div>}</section><section className="panel refund-queue"><div className="panel-heading"><div><small>SAFE REFUND QUEUE</small><h2>待执行退款 · {refunds.length}</h2></div><ShieldCheck /></div>{refunds.map((item) => { const campaign = campaigns.find((entry) => entry.id === item.campaignId)!; return <div className="refund-row" key={item.id}><div><b>{item.userName}</b><small>{campaign.title}</small></div><strong>{money(campaign.refundAmount)}</strong><span><ShieldCheck size={14} />幂等键已锁定</span><button onClick={() => onRefund(item)}>模拟退款</button></div> })}{!refunds.length && <div className="empty-state small"><WalletCards /><p>暂无待执行退款</p></div>}<div className="safety-rules"><b>退款前自动校验</b><span><Check />订单已付款</span><span><Check />反馈已通过</span><span><Check />金额不超上限</span><span><Check />资格未成功退款</span></div></section></div></>
  );
}

function EventLog({ events }: { events: AppState["events"] }) {
  return <><WorkspaceHeading kicker="WORKFLOW EVENTS" title="流程事件日志" /><section className="panel event-panel">{events.length ? events.map((event) => <div className="event-row" key={event.id}><span className={`event-dot actor-${event.actorType}`} /><div><b>{event.eventType}</b><p><code>{event.fromStatus}</code><ArrowRight size={13} /><code>{event.toStatus}</code></p></div><div><b>{event.actorName}</b><small>{new Date(event.createdAt).toLocaleString("zh-CN")}</small></div></div>) : <div className="empty-state"><FileText /><h3>还没有新事件</h3><p>在申请审核或订单演示中执行操作后，这里会留下完整记录。</p></div>}</section></>;
}

function AdminWorkspace({ tab, onTab, state, exceptions, onResolve }: { tab: AdminTab; onTab: (tab: AdminTab) => void; state: AppState; exceptions: Participation[]; onResolve: (item: Participation) => void }) {
  return (
    <><nav className="backoffice-nav"><button className={tab === "exceptions" ? "active" : ""} onClick={() => onTab("exceptions")}><AlertCircle />异常中心{exceptions.length > 0 && <i>{exceptions.length}</i>}</button><button className={tab === "events" ? "active" : ""} onClick={() => onTab("events")}><FileText />全站审计日志</button></nav><div className="workspace-content">{tab === "events" ? <EventLog events={state.events} /> : <><WorkspaceHeading kicker="PLATFORM RISK CONTROL" title="异常中心"><span className="risk-live"><i />风控规则运行中</span></WorkspaceHeading><section className="risk-summary"><article><span className="coral"><AlertCircle /></span><div><small>待人工处理</small><strong>{exceptions.length}</strong></div></article><article><span className="green"><ShieldCheck /></span><div><small>今日拦截重复退款</small><strong>3</strong></div></article><article><span className="amber"><Clock3 /></span><div><small>平均处理时长</small><strong>1.4h</strong></div></article></section><section className="panel exception-panel"><div className="panel-heading"><div><small>MANUAL REVIEW</small><h2>退款异常</h2></div></div>{exceptions.length ? exceptions.map((item) => { const campaign = campaigns.find((entry) => entry.id === item.campaignId)!; return <article className="exception-card" key={item.id}><div className="exception-alert"><AlertCircle /><div><b>{item.refundFailureReason}</b><span>首次失败后已停止自动重试</span></div><StatusPill status={item.status} /></div><div className="exception-detail"><div><small>消费者</small><b>{item.userName}</b></div><div><small>试用活动</small><b>{campaign.title}</b></div><div><small>应退金额</small><b>{money(campaign.refundAmount)}</b></div><div><small>幂等键</small><code>{item.refundIdempotencyKey}</code></div></div><div className="exception-actions"><span><ShieldCheck />操作将写入 Audit Log</span><button className="approve-button" onClick={() => onResolve(item)}>已核对，人工完成退款</button></div></article> }) : <div className="empty-state"><CheckCircle2 /><h3>异常已全部处理</h3><p>系统不会无限重试失败退款。</p></div>}</section></>}</div></>
  );
}
