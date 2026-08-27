"use client";

import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Gauge,
  House,
  Inbox,
  ImagePlus,
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
  Trash2,
  Truck,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { campaigns, initialState, statusLabels } from "@/lib/demo-data";
import { clearFeedbackMedia, listFeedbackMedia, removeFeedbackMedia, saveFeedbackMedia, type StoredFeedbackMedia } from "@/lib/feedback-media";
import { runTransitions, validateRefund } from "@/lib/workflow";
import type { AppState, Campaign, Feedback, FeedbackMedia, Participation, ParticipationStatus, Role } from "@/types";
import jianfengShikeLogo from "../../public/images/brand/jianfeng-shike-logo.jpg";
import milkCakeMacro from "../../public/images/milk-cake-macro-v3.webp";
import osmanthusTeaMacro from "../../public/images/osmanthus-tea-macro-v3.webp";
import seaweedMacro from "../../public/images/seaweed-macro-v3.webp";
import upcomingFoodGrid from "../../public/images/upcoming-food-grid-v2.webp";

type ConsumerTab = "discover" | "mine" | "notifications";
type MerchantTab = "dashboard" | "applications" | "feedback" | "events";
type AdminTab = "exceptions" | "events";

const storageKey = "xinpin-trial-mvp-state-v2";
const currentUser = "demo-user";

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
const money = (value: number) => `¥${value.toFixed(2)}`;
const trialOffer = (campaign: Campaign) => campaign.trialMode === "free" ? "免费试吃" : campaign.trialMode === "low_price" ? `体验价 ${money(campaign.price)}` : "方案待确认";

function ProductVisual({ campaign, compact = false }: { campaign: Campaign; compact?: boolean }) {
  const foodPhotoClasses: Record<string, string> = {
    "seaweed-crisp": "open-food open-food-seaweed",
    "milk-cake": "open-food open-food-cake",
    "osmanthus-tea": "open-food open-food-tea",
    "lazhi-roujiamo": "upcoming-food upcoming-food-roujiamo",
    "butter-saqima": "upcoming-food upcoming-food-saqima",
    "butter-scallion-nougat-cracker": "upcoming-food upcoming-food-cracker",
    "prebiotic-hawthorn-stick": "upcoming-food upcoming-food-hawthorn",
    "seaweed-shrimp-soup": "upcoming-food upcoming-food-soup",
    "juicy-beef-dumpling": "upcoming-food upcoming-food-dumpling",
    "melon-craft-beer": "upcoming-food upcoming-food-beer",
  };
  const openFoodSources: Record<string, typeof seaweedMacro> = {
    "seaweed-crisp": seaweedMacro,
    "milk-cake": milkCakeMacro,
    "osmanthus-tea": osmanthusTeaMacro,
  };
  const photoClass = foodPhotoClasses[campaign.id];
  const photoSource = openFoodSources[campaign.id] ?? upcomingFoodGrid;
  return (
    <div className={`product-visual food-photo-visual ${campaign.category} ${photoClass ?? ""} ${compact ? "compact" : ""}`} style={{ "--accent": campaign.accent, "--food-image": `url(${photoSource.src})` } as React.CSSProperties}>
      <div className="food-photo-layer" role="img" aria-label={`${campaign.title}食物图`} />
      {!compact && <small>{campaign.launchStatus === "preparing" ? "样品图 · 到样确认中" : `${campaign.brand} · 今日试吃`}</small>}
    </div>
  );
}

function Logo() {
  return (
    <div className="brand-mark" aria-label="尖锋食客新品试吃局">
      <Image className="brand-logo-image" src={jianfengShikeLogo} alt="尖锋食客" width={44} height={44} priority />
      <div className="brand-mark-copy"><b>尖锋食客</b><small>新品试吃局</small></div>
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
  { key: "claim", label: "领取", statuses: ["purchased", "shipment_pending", "shipped", "delivered", "feedback_available", "feedback_submitted", "feedback_revision_required", "feedback_resubmitted", "feedback_approved", "refund_pending", "refund_processing", "refund_success", "completed"] },
  { key: "delivery", label: "签收", statuses: ["delivered", "feedback_available", "feedback_submitted", "feedback_revision_required", "feedback_resubmitted", "feedback_approved", "refund_pending", "refund_processing", "refund_success", "completed"] },
  { key: "feedback", label: "反馈", statuses: ["feedback_submitted", "feedback_resubmitted", "feedback_approved", "refund_pending", "refund_processing", "refund_success", "completed"] },
  { key: "complete", label: "完成", statuses: ["completed"] },
];

function ProgressRail({ status }: { status: ParticipationStatus }) {
  const currentIndex = journey.findIndex((item) => !item.statuses.includes(status));
  return (
    <div className="progress-rail" aria-label={`当前状态：${statusLabels[status]}`}>
      {journey.map((item, index) => {
        const done = item.statuses.includes(status);
        const current = !done && (currentIndex === index || (status === "feedback_available" && item.key === "feedback") || (status.startsWith("refund_") && item.key === "complete"));
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
  const [remindedCampaigns, setRemindedCampaigns] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setState(JSON.parse(saved) as AppState);
    } catch { /* keep the seeded demo */ }
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    if (requestedRole === "merchant" || requestedRole === "admin") setRole(requestedRole);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    if (!selectedCampaign) return;
    let secondFrame = 0;
    const resetScroll = () => window.scrollTo({ top: 0, behavior: "auto" });
    resetScroll();
    const firstFrame = window.requestAnimationFrame(() => {
      resetScroll();
      secondFrame = window.requestAnimationFrame(resetScroll);
    });
    const settleTimer = window.setTimeout(resetScroll, 80);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimer);
    };
  }, [selectedCampaign]);

  const myParticipations = useMemo(() => state.participations.filter((item) => item.userId === currentUser), [state.participations]);
  const pendingApplications = state.participations.filter((item) => item.status === "under_review");
  const pendingFeedback = state.participations.filter((item) => ["feedback_submitted", "feedback_resubmitted"].includes(item.status));
  const exceptions = state.participations.filter((item) => item.status === "refund_failed");

  const notify = (message: string) => setToast(message);

  const scrollToPageTop = () => window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));

  const openCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
  };

  const closeCampaign = () => {
    setSelectedCampaign(null);
    window.requestAnimationFrame(() => document.getElementById("campaigns")?.scrollIntoView({ block: "start" }));
  };

  const remindCampaign = (campaign: Campaign) => {
    setRemindedCampaigns((current) => current.includes(campaign.id) ? current : [...current, campaign.id]);
    notify(`已订阅「${campaign.title}」开放提醒`);
  };

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
    scrollToPageTop();
    notify("申请已提交，商家审核结果会在这里显示");
  };

  const approveApplication = (item: Participation) => {
    const token = `QT-${item.campaignId.slice(0, 4).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
    if (advance(item, [
      { to: "approved", event: "trial_application_approved", actor: "merchant", name: "尖锋食客" },
      { to: "purchase_pending", event: "qualification_issued", actor: "system", name: "工作流引擎", metadata: token },
    ], { qualificationToken: token, purchaseExpiresAt: new Date(Date.now() + 48 * 3600_000).toISOString() }, { title: "试用申请通过", body: "你已获得专属领取资格，请在 48 小时内完成领取或体验价下单。" })) notify("审核通过，专属领取资格已自动发放");
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
    if (advance(item, steps, patch, item.status === "shipped" ? { title: "反馈任务已开启", body: "商品已签收，请在 7 天内完成试用反馈。" } : undefined)) notify(item.status === "purchase_pending" ? "已模拟领取，订单进入待发货" : item.status === "shipment_pending" ? "已模拟发货" : "已模拟签收，反馈任务自动开启");
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
      notify("反馈已提交，品牌审核通过后本次试用即完成");
    }
  };

  const requestRevision = (item: Participation) => {
    if (advance(item, [{ to: "feedback_revision_required", event: "feedback_revision_requested", actor: "merchant", name: "尖锋食客", metadata: "请补充一张商品开封后的照片" }], { revisionReason: "请补充一张商品开封后的照片" }, { title: "反馈需要补充", body: "请补充一张商品开封后的照片后重新提交。" })) notify("已退回补充，并通知消费者");
  };

  const approveFeedback = (item: Participation) => {
    if (advance(item, [
      { to: "feedback_approved", event: "feedback_approved", actor: "merchant", name: "尖锋食客" },
      { to: "completed", event: "trial_completed", actor: "system", name: "工作流引擎" },
    ], undefined, { title: "反馈审核通过", body: "本次试用已完成，感谢你的真实反馈。" })) notify("反馈已通过，本次试用已完成");
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
    void clearFeedbackMedia();
    notify("演示数据已重置");
  };

  return (
    <div className={`app-shell role-${role}`}>
      {role === "consumer" ? (
        <>
          <main className="consumer-main">
            {selectedCampaign ? (
              <CampaignDetail campaign={selectedCampaign} onBack={closeCampaign} onApply={() => setApplying(true)} onRemind={() => remindCampaign(selectedCampaign)} alreadyApplied={state.participations.some((item) => item.userId === currentUser && item.campaignId === selectedCampaign.id)} reminded={remindedCampaigns.includes(selectedCampaign.id)} />
            ) : consumerTab === "discover" ? (
              <Discover campaigns={campaigns} onSelect={openCampaign} onRemind={remindCampaign} remindedCampaigns={remindedCampaigns} />
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

const trialReports = [
  { name: "林小雨", product: "烘烤海苔脆片", score: "4.8", quote: "脆度很干净，海苔香先出来，甜味如果再收一点会更耐吃。", tags: ["脆", "海苔香", "少油"] },
  { name: "周元青", product: "鲜奶小蛋糕", score: "4.6", quote: "早餐场景很合适，入口柔软，独立包装比想象中方便。", tags: ["柔软", "奶香", "早餐"] },
  { name: "李知夏", product: "冷泡桂花乌龙", score: "4.7", quote: "桂花香不冲，冰过之后回甘更清楚，适合办公室慢慢喝。", tags: ["清香", "回甘", "低甜"] },
];

const appetiteProfiles: Record<string, { sticker: string; hook: string; tags: string[]; score: string; journey: { label: string; title: string; body: string }[]; moments: string[] }> = {
  "seaweed-crisp": {
    sticker: "咔嚓！",
    hook: "薄、脆、海苔香。",
    tags: ["一掰就响", "少油", "鲜味先到"],
    score: "4.8",
    journey: [
      { label: "第一口", title: "薄脆先响", body: "掰开有碎屑，入口干净，不黏牙。" },
      { label: "嚼到中段", title: "海苔鲜味上来", body: "烘烤香接住鲜味，油感尽量轻。" },
      { label: "咽下后", title: "甜味要收住", body: "尾味不抢戏，才会让人想拿第二片。" },
    ],
    moments: ["追剧时直接吃", "捏碎拌饭", "下午嘴馋来两片"],
  },
  "milk-cake": {
    sticker: "软乎！",
    hook: "撕开，奶香就出来。",
    tags: ["湿润气孔", "轻奶香", "早餐友好"],
    score: "4.6",
    journey: [
      { label: "第一口", title: "表面微微焦香", body: "轻轻一压能回弹，边缘不发干。" },
      { label: "嚼到中段", title: "奶香慢慢铺开", body: "组织湿润柔软，不靠厚重奶油撑味道。" },
      { label: "咽下后", title: "甜度留得轻", body: "早餐吃完不腻，配咖啡也不打架。" },
    ],
    moments: ["早餐配热牛奶", "微波 8 秒", "下午四点垫一口"],
  },
  "osmanthus-tea": {
    sticker: "冰一下！",
    hook: "冰凉、桂花香、慢回甘。",
    tags: ["自然花香", "低甜", "冷泡回甘"],
    score: "4.7",
    journey: [
      { label: "第一口", title: "冰凉先醒口", body: "茶汤清透，入口不粘，不像甜饮料。" },
      { label: "嚼到中段", title: "桂花香浮上来", body: "花香贴着乌龙，不冲鼻，也不香精感。" },
      { label: "咽下后", title: "回甘慢慢回来", body: "尾段保留一点茶感，越冰越清楚。" },
    ],
    moments: ["冰箱冷藏 4 小时", "午饭后解腻", "办公室慢慢喝"],
  },
};

function Discover({ campaigns: items, onSelect, onRemind, remindedCampaigns }: { campaigns: Campaign[]; onSelect: (campaign: Campaign) => void; onRemind: (campaign: Campaign) => void; remindedCampaigns: string[] }) {
  const openCampaigns = items.filter((campaign) => campaign.launchStatus === "open").sort((a, b) => Number(b.trialMode === "free") - Number(a.trialMode === "free"));
  const preparingCampaigns = items.filter((campaign) => campaign.launchStatus === "preparing");
  const freeCount = openCampaigns.filter((campaign) => campaign.trialMode === "free").length;
  const featuredCampaign = openCampaigns.find((campaign) => campaign.trialMode === "free") ?? openCampaigns[0];
  const moreOpenCampaigns = openCampaigns.filter((campaign) => campaign.id !== featuredCampaign?.id);
  return (
    <>
      {featuredCampaign && <section className="food-home-hero page-width">
        <article className="food-hero-card" onClick={() => onSelect(featuredCampaign)}>
          <ProductVisual campaign={featuredCampaign} />
          <div className="food-hero-shade" />
          <div className="food-hero-top"><div className="hero-brand-lockup"><Image src={jianfengShikeLogo} alt="" width={38} height={38} /><span><b>尖锋食客</b><small>今日开吃</small></span></div><b>{featuredCampaign.quota} 份口感共创</b></div>
          <div className="food-hero-copy">
            <span className="free-sticker"><Sparkles size={15} /> {appetiteProfiles[featuredCampaign.id].sticker} 今日免费</span>
            <h1>{appetiteProfiles[featuredCampaign.id].hook}</h1>
            <p>第一口要脆，尾味别太甜。你来决定这片够不够好吃。</p>
            <div className="food-hero-action">
              <button className="food-primary-button" onClick={(event) => { event.stopPropagation(); onSelect(featuredCampaign); }}>免费申请 <ArrowRight size={18} /></button>
              <span><b>{featuredCampaign.quota}</b> 份 · {featuredCampaign.applications.toLocaleString()} 人想试</span>
            </div>
          </div>
        </article>
        <div className="hero-taste-proof" aria-label="这款海苔的口感线索"><b>第一口</b>{appetiteProfiles[featuredCampaign.id].tags.map((taste) => <span key={taste}>{taste}</span>)}<strong><Star size={13} fill="currentColor" /> {appetiteProfiles[featuredCampaign.id].score} 试吃分</strong></div>
      </section>}

      <section className="food-open-section page-width" id="campaigns">
        <div className="food-section-heading"><div><span>MORE TO TASTE</span><h2>今天还能试</h2></div><p>不用原价买，挑真正想吃的。</p></div>
        <div className="food-open-rail">
          {moreOpenCampaigns.map((campaign) => (
            <article className="food-open-card" key={campaign.id} onClick={() => onSelect(campaign)}>
              <div className="food-open-photo"><ProductVisual campaign={campaign} /><span className="bite-sticker">{appetiteProfiles[campaign.id].sticker}</span><span className={`food-offer-sticker ${campaign.trialMode}`}>{trialOffer(campaign)}</span></div>
              <div className="food-open-copy">
                <div><span>{campaign.brand}</span><small>{campaign.id === "milk-cake" ? "3 天后截止" : campaign.deadline}</small></div>
                <h3>{appetiteProfiles[campaign.id].hook}</h3>
                <div className="food-card-tastes">{appetiteProfiles[campaign.id].tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <div className="food-card-proof"><span><Star size={13} fill="currentColor" /> {appetiteProfiles[campaign.id].score} 试吃分</span><small>{campaign.applications.toLocaleString()} 人想试</small></div>
                <footer><span><b>{campaign.quota}</b> 份 · {trialOffer(campaign)}</span><button>想尝一口 <ChevronRight size={17} /></button></footer>
              </div>
            </article>
          ))}
        </div>
      </section>

      {featuredCampaign && <section className="sensory-story page-width">
        <div className="sensory-story-heading"><span>TASTE IT SLOW</span><h2>一口，拆开说。</h2><p>好不好吃，不只一个“好”字。</p></div>
        <div className="sensory-steps">{appetiteProfiles[featuredCampaign.id].journey.map((step, index) => <article key={step.label}><span>{step.label}</span><strong>{step.title}</strong><p>{step.body}</p><i>{index + 1}</i></article>)}</div>
        <blockquote><Star size={18} fill="currentColor" />“脆度很干净，海苔香先出来，甜味如果再收一点会更耐吃。”<span>林小雨 · 真实试吃反馈</span></blockquote>
      </section>}

      <section className="upcoming-section food-upcoming-section page-width">
        <div className="food-section-heading"><div><span>NEXT ON TABLE</span><h2>下一批，到桌了</h2></div><p>先看看实物，想尝就设提醒。</p></div>
        <div className="upcoming-grid">
          {preparingCampaigns.map((campaign) => {
            const reminded = remindedCampaigns.includes(campaign.id);
            return (
              <article className="campaign-card upcoming-card food-upcoming-card" key={campaign.id} onClick={() => onSelect(campaign)}>
                <ProductVisual campaign={campaign} />
                <div className="upcoming-card-body"><span className="prep-chip">样品已记录</span><h3>{campaign.title}</h3><p>{campaign.sampleStatus?.at(-1)}</p><button disabled={reminded} onClick={(event) => { event.stopPropagation(); onRemind(campaign); }}>{reminded ? <><BadgeCheck size={15} />已提醒</> : <><Bell size={15} />开放提醒</>}</button></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="report-section food-report-section page-width">
        <div className="food-section-heading"><div><span>REAL TASTE NOTES</span><h2>真吃过，才有话说</h2></div><p>不是好评墙，是具体的口感判断。</p></div>
        <div className="report-grid">{trialReports.map((report) => <article className="report-card" key={report.product}><div className="report-person"><span>{report.name.slice(0, 1)}</span><div><b>{report.name}</b><small>{report.product}</small></div><strong><Star size={14} fill="currentColor" />{report.score}</strong></div><blockquote>“{report.quote}”</blockquote><div>{report.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></article>)}</div>
      </section>

      <section className="food-promise page-width">
        <div><span>认真试，放心说</span><h2>免费，<br />不等于随便。</h2><p>一人一份，签收后再计时。吃完把甜度、脆度和真实感受说清楚，就完成一次有价值的试吃。</p></div>
        <ol>{["申请想吃的", "获得领取资格", "认真试吃", "留下真反馈"].map((text, index) => <li key={text}><span>{index + 1}</span><b>{text}</b></li>)}</ol>
      </section>
      <footer className="consumer-brand-footer page-width"><Logo /><p>认真吃，具体说。<br />每一条反馈，都为下一版产品负责。</p><span>JIANFENG SHIKE · TRIAL LAB</span></footer>
    </>
  );
}

function CampaignDetail({ campaign, onBack, onApply, onRemind, alreadyApplied, reminded }: { campaign: Campaign; onBack: () => void; onApply: () => void; onRemind: () => void; alreadyApplied: boolean; reminded: boolean }) {
  const flow = ["申请", "资格", "领取", "发货", "签收", "试用", "反馈", "完成"];
  const preparing = campaign.launchStatus === "preparing";
  const primaryLabel = preparing ? reminded ? "已设置开放提醒" : "提醒我开放" : alreadyApplied ? "已申请，可在我的试用查看" : `${trialOffer(campaign)} · 申请试用`;
  const primaryAction = preparing ? onRemind : onApply;
  const primaryDisabled = preparing ? reminded : alreadyApplied;
  const appetite = appetiteProfiles[campaign.id];
  return (
    <div className="detail-page page-width">
      <button className="back-button" onClick={onBack}><ArrowLeft size={18} /> 返回全部试用</button>
      <div className="detail-hero">
        <div className="detail-food-stage"><ProductVisual campaign={campaign} />{appetite && <><span className="detail-bite-sticker">{appetite.sticker}</span><div className="detail-photo-proof"><Star size={14} fill="currentColor" /> {appetite.score} 真实试吃分</div></>}</div>
        <div className="detail-copy">
          <div className="detail-curator"><Image src={jianfengShikeLogo} alt="" width={34} height={34} /><span><small>尖锋食客试吃局</small><b>本期口感共创</b></span></div>
          <span className="brand-kicker">{campaign.brand} · {campaign.launchStatus === "preparing" ? "新品筹备" : "新品首发"}</span>
          <h1>{campaign.title}</h1>
          <p>{campaign.subtitle}</p>
          {appetite && <div className="detail-taste-tags">{appetite.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
          {campaign.launchStatus === "preparing" ? <div className="detail-sample-status"><small>拍摄样状态</small>{campaign.sampleStatus?.map((item) => <span key={item}><CheckCircle2 size={16} />{item}</span>)}</div> : <div className="price-block"><span>试用方式 <b>{campaign.trialMode === "free" ? "免费领取" : "低价体验"}</b></span><i /><span>用户支付 <strong>{campaign.trialMode === "free" ? "¥0" : money(campaign.price)}</strong></span></div>}
          <div className="clarity-note"><ShieldCheck size={21} /><p>{campaign.launchStatus === "preparing" ? <><b>当前仅展示筹备进度</b>免费或低价方案、名额和正式规则确认后再开放申请。</> : <><b>{trialOffer(campaign)}</b>审核通过后凭专属资格领取，一人一份；按期完成真实反馈即可。</>}</p></div>
          <button className="primary-button wide desktop-detail-action" onClick={primaryAction} disabled={primaryDisabled}>{preparing ? <Bell size={18} /> : null}{primaryLabel}{!preparing && <ArrowRight size={18} />}</button>
          <small className="deadline-note"><Clock3 size={14} />{campaign.launchStatus === "preparing" ? campaign.deadline : `申请截止：${campaign.deadline} · 共 ${campaign.quota} 个名额`}</small>
        </div>
      </div>
      {appetite && <section className="detail-sensory page-width">
        <div className="detail-sensory-copy"><span>这一口，会怎么走</span><h2>{appetite.hook}</h2><p>先别急着给“好吃”两个字。我们更想知道，味道在哪一秒出现，又在哪一秒退下去。</p></div>
        <div className="detail-sensory-steps">{appetite.journey.map((step) => <article key={step.label}><span>{step.label}</span><h3>{step.title}</h3><p>{step.body}</p></article>)}</div>
        <aside><span><Leaf size={15} /> 怎么吃更好吃</span>{appetite.moments.map((moment) => <b key={moment}>{moment}</b>)}</aside>
      </section>}
      <div className="rule-layout">
        <section className="rule-main">
          <span className="eyebrow">申请前，请先看清楚</span><h2>一份试用，要走完这 8 步</h2>
          <div className="flow-strip">{flow.map((item, index) => <div key={item}><span>{index + 1}</span><b>{item}</b>{index < flow.length - 1 && <i />}</div>)}</div>
          <h3>什么样的反馈算合格？</h3>
          <ul className="requirement-list">{campaign.requirements.map((item) => <li key={item}><CheckCircle2 size={19} />{item}</li>)}</ul>
          <div className="plain-rules">
            <div><b>反馈期限</b><p>从物流签收时开始计算，共 {campaign.feedbackDays} 天。逾期会影响后续试用资格。</p></div>
            <div><b>审核时间</b><p>品牌通常会在提交后的 1–3 个工作日内完成审核；如需补充，会明确说明原因。</p></div>
            <div><b>费用规则</b><p>{campaign.trialMode === "free" ? "本活动无需支付商品款；是否包邮以活动说明为准。" : `本活动仅收 ${money(campaign.price)} 象征性体验价，不按商品正常售价购买。`}</p></div>
          </div>
        </section>
        <aside className="rule-aside"><ShieldCheck size={26} /><h3>你的每一步都有记录</h3><p>申请、资格、领取、物流和反馈都进入同一条流程轨道。若有争议，可回看完整时间线。</p><span>专属资格不可转让 · 一人一份</span></aside>
      </div>
      <div className="detail-mobile-action"><div><small>{preparing ? "开放后第一时间通知" : campaign.trialMode === "free" ? "本次无需支付商品款" : "象征性体验价"}</small><b>{preparing ? campaign.title : trialOffer(campaign)}</b></div><button className="primary-button" onClick={primaryAction} disabled={primaryDisabled}>{preparing ? <Bell size={18} /> : null}{primaryLabel}</button></div>
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
          <label className="check-label"><input type="checkbox" required /><span>我已阅读并同意试用规则，理解资格仅限本人、一人一份，并会在签收后按期提交真实反馈。</span></label>
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
      <div className="filter-tabs"><button className="active">全部</button><button>进行中</button><button>待领取</button><button>待反馈</button><button>已完成</button></div>
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
                    {item.status === "completed" && <span>反馈已通过，后续试用资格保持良好</span>}
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
    purchase_pending: "请在 48 小时内领取试用",
    shipment_pending: "等待品牌发货",
    shipped: "商品运输中",
    feedback_available: "开始真实试用并提交反馈",
    feedback_submitted: "等待品牌审核反馈",
    feedback_revision_required: "按说明补充反馈",
    feedback_resubmitted: "等待品牌再次审核",
    refund_pending: "等待系统发起退款",
    refund_processing: "历史退款流程处理中",
    completed: "本次试用已完成",
    rejected: "本次申请未通过",
  };
  return map[status] || statusLabels[status];
}

type MediaPreview = FeedbackMedia & { url: string };

const readableSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function FeedbackDialog({ participation, campaign, onClose, onSubmit }: { participation: Participation; campaign: Campaign; onClose: () => void; onSubmit: (item: Participation, feedback: Feedback) => void }) {
  const previous = participation.feedback;
  const [scores, setScores] = useState({ overall: previous?.overall || 0, taste: previous?.taste || 0, packaging: previous?.packaging || 0, value: previous?.value || 0 });
  const [repurchase, setRepurchase] = useState<Feedback["repurchase"]>(previous?.repurchase || "可能会");
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    listFeedbackMedia(participation.id).then((stored) => {
      if (cancelled) return;
      const previews = stored.map((item) => ({ id: item.id, name: item.name, type: item.type, size: item.size, url: URL.createObjectURL(item.blob) }));
      objectUrls.current.push(...previews.map((item) => item.url));
      setMedia(previews);
    }).catch(() => setMediaError("没有读到上次的素材草稿，请重新选择。"));
    return () => {
      cancelled = true;
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = [];
    };
  }, [participation.id]);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const imageTypes = ["image/jpeg", "image/png", "image/webp"];
    const videoTypes = ["video/mp4", "video/webm", "video/quicktime"];
    const unsupported = files.find((file) => !imageTypes.includes(file.type) && !videoTypes.includes(file.type));
    const imageTooLarge = files.find((file) => imageTypes.includes(file.type) && file.size > 10 * 1024 * 1024);
    const videoTooLarge = files.find((file) => videoTypes.includes(file.type) && file.size > 80 * 1024 * 1024);
    const videoCount = media.filter((item) => item.type.startsWith("video/")).length + files.filter((file) => videoTypes.includes(file.type)).length;

    if (media.length + files.length > 3) return setMediaError("最多上传 3 个素材，请先删除一个再添加。 ");
    if (unsupported) return setMediaError(`不支持 ${unsupported.name}，请选择 JPG、PNG、WebP、MP4、MOV 或 WebM。`);
    if (imageTooLarge) return setMediaError(`${imageTooLarge.name} 超过 10 MB，请压缩后再试。`);
    if (videoTooLarge) return setMediaError(`${videoTooLarge.name} 超过 80 MB，请缩短或压缩后再试。`);
    if (videoCount > 1) return setMediaError("一次反馈最多上传 1 段视频。 ");

    setUploading(true);
    setMediaError("");
    try {
      const stored = await Promise.all(files.map((file) => saveFeedbackMedia(participation.id, file)));
      const previews = stored.map((item: StoredFeedbackMedia) => ({ id: item.id, name: item.name, type: item.type, size: item.size, url: URL.createObjectURL(item.blob) }));
      objectUrls.current.push(...previews.map((item) => item.url));
      setMedia((current) => [...current, ...previews]);
    } catch {
      setMediaError("素材没有保存成功，请检查浏览器存储空间后重试。 ");
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (item: MediaPreview) => {
    try {
      await removeFeedbackMedia(participation.id, item.id);
      URL.revokeObjectURL(item.url);
      objectUrls.current = objectUrls.current.filter((url) => url !== item.url);
      setMedia((current) => current.filter((entry) => entry.id !== item.id));
      setMediaError("");
    } catch {
      setMediaError("这个素材暂时删不掉，请刷新后再试。 ");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (Object.values(scores).some((score) => score === 0)) return setMediaError("请先完成四项评分。 ");
    if (!media.length) return setMediaError("请上传至少 1 张真实图片或 1 段试吃视频。 ");
    const mediaRefs = media.map(({ id, name, type, size }) => ({ id, name, type, size }));
    onSubmit(participation, {
      ...scores,
      repurchase,
      liked: String(data.get("liked")),
      improve: String(data.get("improve")),
      review: String(data.get("review")),
      photos: media.filter((item) => item.type.startsWith("image/")).length,
      videos: media.filter((item) => item.type.startsWith("video/")).length,
      media: mediaRefs,
    });
  };
  return (
    <div className="dialog-backdrop feedback-backdrop">
      <div className="dialog feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <div className="feedback-heading"><ProductVisual campaign={campaign} compact /><div><span className="eyebrow">真实试用反馈</span><h2 id="feedback-title">{campaign.title}</h2><p>没有标准答案，具体比好听更重要。</p></div></div>
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
          <div className="media-upload">
            <div className="media-upload-heading">
              <div><span className="media-kicker">FIRST BITE PROOF</span><b>晒出真实试吃现场</b><p>图片最多 3 张，或上传 1 段掰开、倒出、拉丝的视频。</p></div>
              <strong>{media.length}<small>/3</small></strong>
            </div>
            <div className="media-picker-actions">
              <button type="button" onClick={() => imageInput.current?.click()} disabled={uploading || media.length >= 3}><ImagePlus size={19} /><span>添加图片<small>JPG / PNG / WebP</small></span></button>
              <button type="button" onClick={() => videoInput.current?.click()} disabled={uploading || media.length >= 3 || media.some((item) => item.type.startsWith("video/"))}><Video size={19} /><span>添加视频<small>MP4 / MOV / WebM</small></span></button>
              <input ref={imageInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} />
              <input ref={videoInput} className="visually-hidden" type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleFiles} />
            </div>
            {media.length > 0 && <div className="media-preview-grid">{media.map((item) => <figure key={item.id} className={item.type.startsWith("video/") ? "is-video" : ""}>
              <div className="media-preview-frame">{item.type.startsWith("video/") ? <video src={item.url} controls playsInline preload="metadata" /> : <Image src={item.url} alt={`已选择的试吃图片 ${item.name}`} fill sizes="180px" unoptimized />}</div>
              <figcaption><span><b>{item.type.startsWith("video/") ? "试吃视频" : "现场图片"}</b><small>{readableSize(item.size)}</small></span><button type="button" onClick={() => void removeMedia(item)} aria-label={`删除 ${item.name}`}><Trash2 size={15} /></button></figcaption>
            </figure>)}</div>}
            {mediaError && <p className="media-error" role="alert"><AlertCircle size={15} />{mediaError}</p>}
            <div className={`media-save-state ${uploading ? "saving" : ""}`}><CheckCircle2 size={15} /><span>{uploading ? "正在保存原文件…" : media.length ? "原文件已保存在此设备，关闭后再打开也不会丢" : "选择后会保存原文件，不是模拟上传"}</span></div>
          </div>
          <div className="submit-note"><ShieldCheck size={19} /><p>提交后品牌会审核真实性；通过后本次试用完成，并计入你的守约记录。</p></div>
          <button className="primary-button wide" disabled={!media.length || uploading || Object.values(scores).some((score) => score === 0)}>提交真实反馈 <ArrowRight size={18} /></button>
        </form>
      </div>
    </div>
  );
}

function SubmittedMediaStrip({ participationId, media }: { participationId: string; media?: FeedbackMedia[] }) {
  const [items, setItems] = useState<MediaPreview[]>([]);
  useEffect(() => {
    if (!media?.length) return;
    let cancelled = false;
    const urls: string[] = [];
    listFeedbackMedia(participationId).then((stored) => {
      if (cancelled) return;
      const allowed = new Set(media.map((item) => item.id));
      const previews = stored.filter((item) => allowed.has(item.id)).map((item) => ({ id: item.id, name: item.name, type: item.type, size: item.size, url: URL.createObjectURL(item.blob) }));
      urls.push(...previews.map((item) => item.url));
      setItems(previews);
    }).catch(() => setItems([]));
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [participationId, media]);
  if (!items.length) return null;
  return <div className="submitted-media-strip">{items.map((item) => <div key={item.id}>{item.type.startsWith("video/") ? <video src={item.url} controls playsInline preload="metadata" /> : <Image src={item.url} alt="用户提交的真实试吃图片" fill sizes="120px" unoptimized />}</div>)}</div>;
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
}

function MerchantWorkspace(props: MerchantProps) {
  const nav = [{ id: "dashboard", label: "经营总览", icon: LayoutDashboard }, { id: "applications", label: "申请审核", icon: UsersRound, count: props.pendingApplications.length }, { id: "feedback", label: "反馈审核", icon: ClipboardCheck, count: props.pendingFeedback.length }, { id: "events", label: "流程日志", icon: FileText }];
  const activeOrders = props.state.participations.filter((item) => ["purchase_pending", "purchased", "shipment_pending", "shipped"].includes(item.status));
  return (
    <>
      <nav className="backoffice-nav">{nav.map((item) => <button key={item.id} className={props.tab === item.id ? "active" : ""} onClick={() => props.onTab(item.id as MerchantTab)}><item.icon size={18} />{item.label}{item.count ? <i>{item.count}</i> : null}</button>)}</nav>
      <div className="workspace-content">
        {props.tab === "dashboard" && <MerchantDashboard state={props.state} applications={props.pendingApplications} feedback={props.pendingFeedback} exceptions={props.exceptions} onGo={props.onTab} activeOrders={activeOrders} onSimulate={props.onSimulate} />}
        {props.tab === "applications" && <ApplicationReview items={props.pendingApplications} onApprove={props.onApprove} onReject={props.onReject} />}
        {props.tab === "feedback" && <FeedbackReview pending={props.pendingFeedback} onRevision={props.onRevision} onApprove={props.onApproveFeedback} />}
        {props.tab === "events" && <EventLog events={props.state.events} />}
      </div>
    </>
  );
}

function WorkspaceHeading({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return <div className="workspace-heading"><div><span>{kicker}</span><h1>{title}</h1><p>2026年08月25日 · 所有数字均为演示数据</p></div>{children}</div>;
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
        <button><span className="todo-icon amber"><AlertCircle /></span><div><b>{exceptions.length}</b><p>个履约异常</p></div><ChevronRight /></button>
      </section>
      <section className="metric-grid">
        {[{ label: "进行中的活动", value: 3, note: "1 个本周截止" }, { label: "今日新申请", value: 82, note: "较昨日 +14%" }, { label: "已发放资格", value: 500, note: "领取率 92.6%" }, { label: "已完成试用", value: 410 + completed, note: "反馈合格率 96.7%" }].map((item) => <article key={item.label}><small>{item.label}</small><strong>{item.value}</strong><span>{item.note}</span></article>)}
      </section>
      <div className="dashboard-columns">
        <section className="panel funnel-panel"><div className="panel-heading"><div><small>鲜奶小蛋糕新品试吃</small><h2>活动转化漏斗</h2></div><button>查看活动 <ArrowRight size={16} /></button></div><div className="funnel-bars">{[{ name: "浏览", value: 2183, rate: 100 }, { name: "申请", value: 1268, rate: 58 }, { name: "通过", value: 500, rate: 40 }, { name: "领取", value: 463, rate: 37 }, { name: "签收", value: 451, rate: 36 }, { name: "反馈合格", value: 413, rate: 33 }, { name: "试用完成", value: 410, rate: 32 }].map((item) => <div key={item.name}><span>{item.name}</span><i><b style={{ width: `${item.rate}%` }} /></i><strong>{item.value.toLocaleString()}</strong></div>)}</div></section>
        <section className="panel activity-panel"><div className="panel-heading"><div><small>MOCK FULFILLMENT ADAPTER</small><h2>领取与发货演示</h2></div></div>{activeOrders.length ? activeOrders.slice(0, 4).map((item) => { const campaign = campaigns.find((entry) => entry.id === item.campaignId)!; return <div className="adapter-row" key={item.id}><ProductVisual campaign={campaign} compact /><div><b>{item.userName} · {campaign.title}</b><StatusPill status={item.status} /></div><button onClick={() => onSimulate(item)}>{item.status === "purchase_pending" ? "模拟领取" : item.status === "shipment_pending" ? "模拟发货" : "模拟签收"}<ChevronRight size={15} /></button></div> }) : <div className="empty-state small"><PackageCheck /><p>暂无待推进的模拟订单</p></div>}</section>
      </div>
    </>
  );
}

function ApplicationReview({ items, onApprove, onReject }: { items: Participation[]; onApprove: (item: Participation) => void; onReject: (item: Participation) => void }) {
  return (
    <><WorkspaceHeading kicker="APPLICATION REVIEW" title="申请审核"><div className="search-box"><Search size={17} /><input placeholder="搜索用户或城市" /></div></WorkspaceHeading><section className="panel table-panel"><div className="table-toolbar"><div><button className="active">待审核 {items.length}</button><button>已通过</button><button>已拒绝</button></div><button className="outline-button small">批量操作</button></div>{items.length ? <div className="application-table"><div className="table-head"><span>用户</span><span>申请理由</span><span>历史表现</span><span>申请时间</span><span>操作</span></div>{items.map((item) => <div className="table-row" key={item.id}><div className="user-cell"><span>{item.userName.slice(0, 1)}</span><div><b>{item.userName}</b><small>{item.city} · {item.age}</small></div></div><p>{item.reason}</p><div className="history-cell"><b>{item.userId.includes("zhou") ? "4 / 4" : "6 / 6"}</b><small>参与 / 完成</small><i><b style={{ width: "100%" }} /></i></div><div><b>今天</b><small>{item.id.includes("zhou") ? "09:42" : "10:16"}</small></div><div className="row-actions"><button className="reject-button" onClick={() => onReject(item)}>拒绝</button><button className="approve-button" onClick={() => onApprove(item)}>通过</button></div></div>)}</div> : <div className="empty-state"><CheckCircle2 /><h3>申请已全部处理</h3><p>新的申请会自动出现在这里。</p></div>}</section></>
  );
}

function FeedbackReview({ pending, onRevision, onApprove }: { pending: Participation[]; onRevision: (item: Participation) => void; onApprove: (item: Participation) => void }) {
  return (
    <><WorkspaceHeading kicker="FEEDBACK REVIEW" title="反馈审核" /><div className="feedback-workspace"><section className="panel"><div className="panel-heading"><div><small>WAITING FOR REVIEW</small><h2>待审核反馈 · {pending.length}</h2></div></div>{pending.length ? pending.map((item) => { const campaign = campaigns.find((entry) => entry.id === item.campaignId)!; return <article className="feedback-review-card" key={item.id}><div className="feedback-person"><ProductVisual campaign={campaign} compact /><div><b>{item.userName}</b><small>{campaign.title}</small></div><div className="review-score"><Star fill="currentColor" />{item.feedback?.overall || 4}.0</div></div><div className="feedback-excerpt"><b>真实试用感受</b><p>{item.feedback?.review || "反馈内容已提交，等待审核。"}</p><span>{item.feedback?.photos || 0} 张图片 · {item.feedback?.videos || 0} 段视频 · 提交于今天 11:20</span></div><SubmittedMediaStrip participationId={item.id} media={item.feedback?.media} /><div className="review-actions"><button className="reject-button" onClick={() => onRevision(item)}><RefreshCcw size={15} />需要补充</button><button className="approve-button" onClick={() => onApprove(item)}><Check size={15} />审核通过并完成试用</button></div></article> }) : <div className="empty-state small"><CheckCircle2 /><p>暂无待审核反馈</p></div>}</section><section className="panel refund-queue"><div className="panel-heading"><div><small>TRIAL OFFER</small><h2>本期试用机制</h2></div><ShieldCheck /></div><div className="refund-row"><div><b>免费试吃</b><small>适合食品小样与首轮口感验证</small></div><strong>¥0</strong><span><ShieldCheck size={14} />一人一份</span></div><div className="refund-row"><div><b>低价体验</b><small>仅用于较高成本样品，降低随手申领</small></div><strong>¥1–9.9</strong><span><ShieldCheck size={14} />不按原价购买</span></div><div className="safety-rules"><b>领取前自动校验</b><span><Check />同活动未重复领取</span><span><Check />资格码有效</span><span><Check />历史完成率达标</span><span><Check />异常账号需人工复核</span></div></section></div></>
  );
}

function EventLog({ events }: { events: AppState["events"] }) {
  return <><WorkspaceHeading kicker="WORKFLOW EVENTS" title="流程事件日志" /><section className="panel event-panel">{events.length ? events.map((event) => <div className="event-row" key={event.id}><span className={`event-dot actor-${event.actorType}`} /><div><b>{event.eventType}</b><p><code>{event.fromStatus}</code><ArrowRight size={13} /><code>{event.toStatus}</code></p></div><div><b>{event.actorName}</b><small>{new Date(event.createdAt).toLocaleString("zh-CN")}</small></div></div>) : <div className="empty-state"><FileText /><h3>还没有新事件</h3><p>在申请审核或订单演示中执行操作后，这里会留下完整记录。</p></div>}</section></>;
}

function AdminWorkspace({ tab, onTab, state, exceptions, onResolve }: { tab: AdminTab; onTab: (tab: AdminTab) => void; state: AppState; exceptions: Participation[]; onResolve: (item: Participation) => void }) {
  return (
    <><nav className="backoffice-nav"><button className={tab === "exceptions" ? "active" : ""} onClick={() => onTab("exceptions")}><AlertCircle />异常中心{exceptions.length > 0 && <i>{exceptions.length}</i>}</button><button className={tab === "events" ? "active" : ""} onClick={() => onTab("events")}><FileText />全站审计日志</button></nav><div className="workspace-content">{tab === "events" ? <EventLog events={state.events} /> : <><WorkspaceHeading kicker="PLATFORM RISK CONTROL" title="异常中心"><span className="risk-live"><i />风控规则运行中</span></WorkspaceHeading><section className="risk-summary"><article><span className="coral"><AlertCircle /></span><div><small>待人工处理</small><strong>{exceptions.length}</strong></div></article><article><span className="green"><ShieldCheck /></span><div><small>今日拦截重复领取</small><strong>3</strong></div></article><article><span className="amber"><Clock3 /></span><div><small>平均处理时长</small><strong>1.4h</strong></div></article></section><section className="panel exception-panel"><div className="panel-heading"><div><small>MANUAL REVIEW</small><h2>资格与履约异常</h2></div></div>{exceptions.length ? exceptions.map((item) => { const campaign = campaigns.find((entry) => entry.id === item.campaignId)!; return <article className="exception-card" key={item.id}><div className="exception-alert"><AlertCircle /><div><b>{item.refundFailureReason}</b><span>异常已停止自动推进，等待人工核对</span></div><StatusPill status={item.status} /></div><div className="exception-detail"><div><small>消费者</small><b>{item.userName}</b></div><div><small>试用活动</small><b>{campaign.title}</b></div><div><small>当前状态</small><b>{statusLabels[item.status]}</b></div><div><small>资格标识</small><code>{item.qualificationToken}</code></div></div><div className="exception-actions"><span><ShieldCheck />操作将写入 Audit Log</span><button className="approve-button" onClick={() => onResolve(item)}>已核对，完成处理</button></div></article> }) : <div className="empty-state"><CheckCircle2 /><h3>当前没有履约异常</h3><p>重复领取、失效资格和异常账号会在这里进入人工复核。</p></div>}</section></>}</div></>
  );
}
