"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./analytics.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
type Tab =
  | "overview"
  | "analytics"
  | "staff"
  | "users"
  | "vendors"
  | "calls"
  | "payments"
  | "refunds"
  | "disputes"
  | "reconciliation"
  | "withdrawals"
  | "reports"
  | "appeals"
  | "review_reports"
  | "blocked_terms"
  | "support"
  | "file_scans"
  | "fraud"
  | "restrictions"
  | "catalog"
  | "gift_cards"
  | "digital_gifts"
  | "memberships"
  | "settings"
  | "campaigns"
  | "audit";
const nav: { id: Tab; icon: string; label: string }[] = [
  { id: "overview", icon: "▦", label: "Overview" },
  { id: "analytics", icon: "⌁", label: "Analytics" },
  { id: "staff", icon: "⚿", label: "Staff access" },
  { id: "users", icon: "●", label: "Users" },
  { id: "vendors", icon: "✦", label: "Creators" },
  { id: "calls", icon: "◉", label: "Call logs" },
  { id: "payments", icon: "◆", label: "Payments" },
  { id: "refunds", icon: "↙", label: "Refunds" },
  { id: "disputes", icon: "!", label: "Disputes" },
  { id: "reconciliation", icon: "≈", label: "Reconciliation" },
  { id: "withdrawals", icon: "↗", label: "Withdrawals" },
  { id: "reports", icon: "⚑", label: "Trust & safety" },
  { id: "appeals", icon: "⚖", label: "Appeals" },
  { id: "review_reports", icon: "★", label: "Review reports" },
  { id: "blocked_terms", icon: "⌫", label: "Blocked terms" },
  { id: "support", icon: "♡", label: "Support" },
  { id: "file_scans", icon: "⌁", label: "File quarantine" },
  { id: "fraud", icon: "◎", label: "Risk signals" },
  { id: "restrictions", icon: "⊘", label: "Restrictions" },
  { id: "catalog", icon: "◇", label: "Catalog" },
  { id: "gift_cards", icon: "▣", label: "Gift cards" },
  { id: "digital_gifts", icon: "✧", label: "Digital gifts" },
  { id: "memberships", icon: "♢", label: "Memberships" },
  { id: "settings", icon: "⚙", label: "Platform settings" },
  { id: "campaigns", icon: "✉", label: "Notifications" },
  { id: "audit", icon: "≡", label: "Audit log" },
];
async function request(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      Array.isArray(body.message)
        ? body.message.join(", ")
        : (body.message ?? `Request failed (${response.status})`),
    );
  }
  return response.json();
}
export default function Operations() {
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("01900000000");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setToken(localStorage.getItem("adminToken") ?? "");
  }, []);
  const endpoint = useMemo(
    () =>
      ({
        overview: "/admin/dashboard",
        analytics: "/admin/exports/analytics",
        staff: "/admin/staff",
        users: "/admin/users",
        vendors: "/admin/vendors/pending",
        calls: "/admin/calls",
        payments: "/payments/admin/pending",
        refunds: "/payments/admin/refunds",
        disputes: "/payments/admin/disputes",
        reconciliation: "/payments/admin/reconciliation-issues",
        withdrawals: "/admin/withdrawals",
        reports: "/admin/reports",
        appeals: "/admin/appeals",
        review_reports: "/admin/reviews/reports",
        blocked_terms: "/moderation/blocked-terms",
        support: "/admin/support",
        file_scans: "/files/admin/scan-queue",
        fraud: "/admin/fraud",
        restrictions: "/admin/restrictions",
        catalog: "/admin/packages",
        gift_cards: "/admin/gift-cards",
        digital_gifts: "/admin/digital-gifts",
        memberships: "/admin/memberships",
        settings: "/admin/settings",
        campaigns: "/admin/notification-campaigns",
        audit: "/admin/audit-logs",
      })[tab],
    [tab],
  );
  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setData(await request(endpoint, token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [token, endpoint]);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          password,
          deviceId: "admin-web",
          deviceName: "Operations Console",
        }),
      }).then(async (response) => {
        if (!response.ok) throw new Error("Invalid credentials");
        return response.json();
      });
      localStorage.setItem("adminToken", result.accessToken);
      setToken(result.accessToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };
  const action = async (path: string, body?: unknown, method = "PATCH") => {
    setLoading(true);
    try {
      await request(path, token, { method, body: JSON.stringify(body ?? {}) });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
      setLoading(false);
    }
  };
  const downloadFinance = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/exports/finance.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not export finance data");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `socialconnect-finance-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };
  if (!token)
    return (
      <main className="auth">
        <section className="login">
          <div className="brandMark">S</div>
          <p className="eyebrow">SOCIALCONNECT</p>
          <h1>Operations, beautifully clear.</h1>
          <p className="muted">
            Secure access for administrators, Finance and Trust & Safety.
          </p>
          <form onSubmit={login}>
            <label>
              Phone number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button disabled={loading || !phone || !password}>
              {loading ? "Signing in…" : "Open operations console"}
            </button>
          </form>
        </section>
      </main>
    );
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="brandMark small">S</div>
          <div>
            <strong>SocialConnect</strong>
            <span>Operations</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              <i>{item.icon}</i>
              {item.label}
            </button>
          ))}
        </nav>
        <button
          className="logout"
          onClick={() => {
            localStorage.removeItem("adminToken");
            setToken("");
          }}
        >
          ↗ Sign out
        </button>
      </aside>
      <main className="workspace">
        <header>
          <div>
            <p className="eyebrow">LIVE OPERATIONS</p>
            <h1>{nav.find((item) => item.id === tab)?.label}</h1>
          </div>
          <div className="headerActions">
            {tab === "reconciliation" && (
              <button
                onClick={() => action("/payments/admin/reconcile", {}, "POST")}
              >
                Run reconciliation
              </button>
            )}
            {tab === "analytics" && (
              <button onClick={downloadFinance}>Download finance CSV</button>
            )}
            <button className="secondary" onClick={load}>
              ↻ Refresh
            </button>
            <div className="avatar">A</div>
          </div>
        </header>
        {error && <div className="alert">{error}</div>}
        {loading && <div className="progress" />}
        {tab === "overview" ? (
          <Overview data={data} />
        ) : tab === "analytics" ? (
          <Analytics data={data} />
        ) : tab === "staff" ? (
          <StaffAccess data={Array.isArray(data) ? data : []} action={action} />
        ) : tab === "settings" ? (
          <PlatformSettings data={Array.isArray(data) ? data : []} action={action} />
        ) : tab === "gift_cards" || tab === "digital_gifts" ? (
          <GiftCatalog tab={tab} data={Array.isArray(data)?data:[]} action={action}/>
        ) : tab === "campaigns" ? (
          <Campaigns data={Array.isArray(data)?data:[]} action={action}/>
        ) : tab === "calls" ? (
          <CallLogs data={Array.isArray(data)?data:[]} action={action}/>
        ) : tab === "blocked_terms" ? (
          <BlockedTerms data={Array.isArray(data)?data:[]} action={action}/>
        ) : (
          <Collection
            tab={tab}
            data={Array.isArray(data) ? data : []}
            action={action}
          />
        )}
      </main>
    </div>
  );
}

function BlockedTerms({data,action}:{data:any[];action:(path:string,body?:unknown,method?:string)=>Promise<void>}){
  return <><section className="panel"><div className="tableHead"><strong>Add a safety filter</strong><span>Terms are normalized and enforced during message submission</span></div><form className="record" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);void action('/moderation/blocked-terms',{term:String(form.get('term')),category:String(form.get('category')),severity:String(form.get('severity'))},'POST')}}><div className="recordMain"><input name="term" minLength={2} maxLength={100} placeholder="Blocked word or phrase" required/><input name="category" maxLength={50} defaultValue="ABUSE" required/><select name="severity" defaultValue="BLOCK"><option>BLOCK</option><option>WARN</option></select></div><div className="recordActions"><button type="submit">Add filter</button></div></form></section><section className="panel"><div className="tableHead"><strong>{data.length} moderation terms</strong><span>Changes take effect immediately and remain permission protected</span></div><div className="cards">{data.map(item=><article className="record" key={item.id}><div className="recordMain"><span className="badge">{item.active?'ACTIVE':'PAUSED'}</span><h3>{item.term}</h3><p>{item.category} · {item.severity}</p></div><div className="recordActions"><button className="secondary" onClick={()=>action(`/moderation/blocked-terms/${item.id}`,{active:!item.active})}>{item.active?'Pause':'Activate'}</button><button className="danger" onClick={()=>action(`/moderation/blocked-terms/${item.id}`,{},'DELETE')}>Remove</button></div></article>)}</div></section></>
}

function CallLogs({data,action}:{data:any[];action:(path:string,body?:unknown,method?:string)=>Promise<void>}){
  return <section className="panel"><div className="tableHead"><strong>{data.length} recent call sessions</strong><span>Server-authoritative duration, settlement and provider metadata</span></div><div className="cards">{data.map(call=><article className="record" key={call.id}><div className="recordMain"><span className="badge">{call.status}</span><h3>{call.caller?.displayName??call.caller?.username??'Member'} → {call.vendor?.user?.profile?.displayName??call.vendor?.legalName??'Creator'}</h3><p>{call.callType} · {call.billedSeconds}s billed / {call.durationSeconds}s connected · {call.grossAmount} pts gross</p><small>{call.provider} · {call.channelName} · creator {call.vendorAmount} pts · platform {call.platformAmount} pts · {call.paymentSourceType}{call.disconnectReason?` · ${call.disconnectReason}`:''}{call.disputeStatus!=='NONE'?` · dispute ${call.disputeStatus}`:''}</small><small>{new Date(call.createdAt).toLocaleString()}{call.endedAt?` → ${new Date(call.endedAt).toLocaleString()}`:''} · ended by {call.endedBy??'—'}</small></div>{['REQUESTED','ACCEPTED','CONNECTING','ACTIVE'].includes(call.status)&&<div className="recordActions"><button className="danger" onClick={()=>action(`/admin/calls/${call.id}/terminate`,{},'POST')}>Terminate safely</button></div>}</article>)}</div></section>
}

function Campaigns({data,action}:{data:any[];action:(path:string,body?:unknown,method?:string)=>Promise<void>}){
  return <><section className="panel"><div className="tableHead"><strong>Compose notification</strong><span>Queued for in-app and each member’s enabled outbound channels</span></div><form className="record" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget),role=String(form.get('role'));void action('/admin/notification-campaigns',{title:String(form.get('title')),body:String(form.get('body')),type:String(form.get('type')||'PROMOTIONAL_OFFER'),...(role==='ALL'?{}:{role})},'POST')}}><div className="recordMain"><input name="title" maxLength={120} placeholder="Notification title" required/><textarea name="body" maxLength={500} rows={4} placeholder="Clear, respectful message" required/><input name="type" defaultValue="PROMOTIONAL_OFFER"/><select name="role" defaultValue="ALL"><option value="ALL">All active members</option><option value="USER">Regular users</option><option value="VENDOR">Creators</option><option value="ADMIN">Administrators</option></select></div><div className="recordActions"><button type="submit">Queue campaign</button></div></form></section><section className="panel"><div className="tableHead"><strong>Campaign history</strong><span>Audited recipient counts and delivery queue status</span></div><div className="cards">{data.map(item=><article className="record" key={item.id}><div className="recordMain"><span className="badge">{item.status}</span><h3>{item.title}</h3><p>{item.body}</p><small>{item.recipientCount} recipients · {new Date(item.createdAt).toLocaleString()}</small></div></article>)}</div></section></>
}

function GiftCatalog({tab,data,action}:{tab:'gift_cards'|'digital_gifts';data:any[];action:(path:string,body?:unknown,method?:string)=>Promise<void>}){
  const digital=tab==='digital_gifts';
  return <><section className="panel"><div className="tableHead"><strong>Create {digital?'digital gift':'gift card'}</strong><span>{digital?'Animation assets may use a private CDN URL':'Voice, video and message allowances are server enforced'}</span></div><form className="record" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget),number=(key:string)=>Number(form.get(key)??0),body=digital?{name:String(form.get('name')),iconUrl:String(form.get('iconUrl')),animationUrl:String(form.get('animationUrl'))||undefined,category:String(form.get('category')||'STANDARD'),pointPrice:number('pointPrice'),vendorPercent:number('vendorPercent'),enabledInCalls:true,enabledInChats:true,displayOrder:data.length}:{name:String(form.get('name')),type:String(form.get('type')),price:number('price'),voiceSeconds:number('voiceSeconds'),videoSeconds:number('videoSeconds'),messageCount:number('messageCount'),validityDays:number('validityDays'),transferable:form.get('transferable')==='on',vendorSpecific:form.get('vendorSpecific')==='on'};void action(`/admin/${digital?'digital-gifts':'gift-cards'}`,body,'POST')}}><div className="recordMain"><input name="name" placeholder="Name" required/>{digital?<><input name="iconUrl" placeholder="Icon URL or emoji" required/><input name="animationUrl" placeholder="Animation URL (optional)"/><input name="category" placeholder="Category" defaultValue="STANDARD"/><input name="pointPrice" type="number" min="1" placeholder="Point price" required/><input name="vendorPercent" type="number" min="0" max="100" defaultValue="60" required/></>:<><select name="type" defaultValue="VOICE"><option>VOICE</option><option>VIDEO</option><option>CHAT</option></select><input name="price" type="number" min="1" placeholder="Price points" required/><input name="voiceSeconds" type="number" min="0" placeholder="Voice seconds" defaultValue="0"/><input name="videoSeconds" type="number" min="0" placeholder="Video seconds" defaultValue="0"/><input name="messageCount" type="number" min="0" placeholder="Messages" defaultValue="0"/><input name="validityDays" type="number" min="1" defaultValue="7"/><label><input name="transferable" type="checkbox"/> Transferable</label><label><input name="vendorSpecific" type="checkbox"/> Vendor-specific</label></>}</div><div className="recordActions"><button type="submit">Create</button></div></form></section><section className="panel"><div className="tableHead"><strong>{data.length} configured items</strong><span>Ordered, priced and controlled by operations</span></div><div className="cards">{data.map(item=><article className="record" key={item.id}><div className="recordMain"><span className="badge">{item.active?'ACTIVE':'INACTIVE'}</span><h3>{digital?`${item.iconUrl} ${item.name}`:item.name}</h3><p>{digital?`${item.category} · ${item.pointPrice} points · ${item.vendorPercent}% creator`:`${item.type} · ${item.price} points · ${item.validityDays} days`}</p></div><div className="recordActions"><button className="secondary" onClick={()=>action(`/admin/${digital?'digital-gifts':'gift-cards'}/${item.id}`,{active:!item.active})}>{item.active?'Deactivate':'Activate'}</button></div></article>)}</div></section></>
}

function PlatformSettings({data,action}:{data:any[];action:(path:string,body?:unknown,method?:string)=>Promise<void>}){
  const defaults=[
    ['DEFAULT_VENDOR_COMMISSION',{percent:60},'Default creator revenue percentage'],
    ['EARNING_HOLD_DAYS',{days:7},'Fraud and dispute holding period'],
    ['CALL_GRACE_SECONDS',{seconds:30},'Reconnection grace period'],
    ['BILLING_ROUNDING',{method:'EXACT_SECOND'},'EXACT_SECOND, UP_30_SECONDS, UP_FULL_MINUTE or MINIMUM_ONE_MINUTE'],
    ['POINT_CONVERSION',{currencyMinorUnitsPerPoint:100,currency:'BDT'},'Point-to-currency accounting reference'],
    ['WITHDRAWAL_RULES',{minimum:500,maximumDaily:50000,feePoints:0,requiredAccountAgeDays:0,requiredCompletedCalls:0,requiredIdentityVerification:false},'Withdrawal limits, fee and eligibility requirements'],
  ] as const;
  const records=defaults.map(([key,value,description])=>data.find(item=>item.key===key)??{key,value,description});
  return <section className="panel"><div className="tableHead"><strong>Financial and call controls</strong><span>Changes are validated by server settlement policy and recorded in the audit log</span></div><div className="cards">{records.map(item=><form className="record" key={item.key} onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{void action(`/admin/settings/${item.key}`,{value:JSON.parse(String(form.get('value'))),description:String(form.get('description')??'')})}catch{}}}><div className="recordMain"><span className="badge">CONFIGURATION</span><h3>{item.key.replaceAll('_',' ').toLowerCase()}</h3><input name="description" defaultValue={item.description??''}/><textarea name="value" defaultValue={JSON.stringify(item.value,null,2)} rows={4}/></div><div className="recordActions"><button type="submit">Save setting</button></div></form>)}</div></section>
}

function StaffAccess({
  data,
  action,
}: {
  data: any[];
  action: (path: string, body?: unknown, method?: string) => Promise<void>;
}) {
  return (
    <section className="panel">
      <div className="tableHead">
        <strong>{data.length} staff accounts</strong>
        <span>Role defaults with audited individual overrides</span>
      </div>
      <div className="staffGrid">
        {data.map((member) => (
          <article className="staffCard" key={member.id}>
            <div className="staffIdentity">
              <div className="avatar">
                {(member.profile?.displayName ?? member.phone)[0]}
              </div>
              <div>
                <h3>{member.profile?.displayName ?? member.phone}</h3>
                <p>
                  {member.role.toLowerCase()} · {member.status.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="permissionList">
              {member.permissions.map((permission: any) => (
                <label key={permission.permission}>
                  <span>
                    {permission.permission.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <input
                    type="checkbox"
                    checked={permission.allowed}
                    onChange={(event) =>
                      action(
                        `/admin/staff/${member.id}/permissions`,
                        {
                          permission: permission.permission,
                          allowed: event.target.checked,
                          reason: "Updated from operations console",
                        },
                        "PUT",
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Overview({ data }: { data: any }) {
  const metrics = [
    {
      label: "Total users",
      value: data?.users ?? 0,
      hint: "All registered accounts",
    },
    {
      label: "Verified creators",
      value: data?.approvedVendors ?? 0,
      hint: "Approved and earning",
    },
    { label:"Active users",value:data?.activeUsers??0,hint:`${data?.onlineUsers??0} online now` },
    { label:"Pending creators",value:data?.pendingVendors??0,hint:"Identity review queue" },
    { label:"Calls today",value:data?.callsToday??0,hint:`${data?.callMinutesToday??0} billed minutes` },
    { label:"Messages today",value:data?.messagesToday??0,hint:"Real-time conversations" },
    { label:"Gifts today",value:data?.giftsToday??0,hint:"Paid digital moments" },
    { label:"Gross revenue today",value:`${data?.grossRevenueToday??0} pts`,hint:"Calls and digital gifts" },
    { label:"Creator earnings today",value:`${data?.vendorEarningsToday??0} pts`,hint:"Pending and available earnings" },
    { label:"Commission today",value:`${data?.platformCommissionToday??0} pts`,hint:"Platform share" },
    { label:"Payment health",value:`${data?.successfulPaymentsToday??0} / ${data?.failedPaymentsToday??0}`,hint:"Successful / failed today" },
    {
      label: "Pending payments",
      value: data?.pendingPayments ?? 0,
      hint: "Needs Finance review",
    },
    {
      label: "Pending withdrawals",
      value: data?.pendingWithdrawals ?? 0,
      hint: "Funds currently held",
    },
    {
      label: "Open reports",
      value: data?.openReports ?? 0,
      hint: "Trust queue",
    },
    {
      label: "Platform revenue",
      value: `${data?.platformRevenue ?? 0} pts`,
      hint: "Recorded commissions",
    },
  ];
  return (
    <>
      <section className="hero">
        <div>
          <span className="status">
            <b /> Systems operational
          </span>
          <h2>Good decisions start with a calm dashboard.</h2>
          <p>Finance, creator health and community safety at a glance.</p>
        </div>
        <div className="heroOrb">✦</div>
      </section>
      <section className="metrics">
        {metrics.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </article>
        ))}
      </section>
      <section className="panel empty">
        <div className="emptyIcon">⌁</div>
        <h3>Operations timeline</h3>
        <p>
          Audit events and reconciliation summaries will appear here as your
          team works.
        </p>
      </section>
    </>
  );
}
function Analytics({ data }: { data: any }) {
  const payments = data?.payments ?? [];
  const calls = data?.calls ?? [];
  const totals = {
    revenue: payments.reduce((sum: number, item: any) => sum + item.revenue, 0),
    payments: payments.reduce(
      (sum: number, item: any) => sum + item.successful,
      0,
    ),
    calls: calls.reduce((sum: number, item: any) => sum + item.calls, 0),
    minutes: calls.reduce((sum: number, item: any) => sum + item.minutes, 0),
  };
  const peak = Math.max(1, ...payments.map((item: any) => item.revenue));
  return (
    <>
      <section className="metrics">
        <article>
          <span>30-day revenue</span>
          <strong>{totals.revenue} pts</strong>
          <small>Approved net purchases</small>
        </article>
        <article>
          <span>Successful payments</span>
          <strong>{totals.payments}</strong>
          <small>Approved and settled</small>
        </article>
        <article>
          <span>Completed calls</span>
          <strong>{totals.calls}</strong>
          <small>Billable sessions</small>
        </article>
        <article>
          <span>Call minutes</span>
          <strong>{totals.minutes}</strong>
          <small>Connected and billed</small>
        </article>
      </section>
      <section className="panel">
        <div className="tableHead">
          <strong>Revenue trend</strong>
          <span>Last 30 days</span>
        </div>
        <div className="trend">
          {payments.length ? (
            payments.map((item: any) => (
              <div className="trendRow" key={item.day}>
                <time>
                  {new Date(item.day).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <div>
                  <i
                    style={{
                      width: `${Math.max(3, (item.revenue / peak) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{item.revenue} pts</strong>
              </div>
            ))
          ) : (
            <p className="muted">No settled payments in this period.</p>
          )}
        </div>
      </section>
    </>
  );
}
function Collection({
  tab,
  data,
  action,
}: {
  tab: Tab;
  data: any[];
  action: (path: string, body?: unknown, method?: string) => Promise<void>;
}) {
  if (!data.length)
    return (
      <section className="panel empty">
        <div className="emptyIcon">✓</div>
        <h3>Nothing needs attention</h3>
        <p>This queue is currently clear.</p>
      </section>
    );
  return (
    <section className="panel">
      <div className="tableHead">
        <strong>{data.length} records</strong>
        <span>Newest and highest priority first</span>
      </div>
      <div className="cards">
        {data.map((item) => (
          <article className="record" key={item.id}>
            <div className="recordMain">
              <span className="badge">
                {item.status ??
                  item.action ??
                  item.role ??
                  item.type ??
                  "ACTIVE"}
              </span>
              <h3>
                {item.user?.profile?.displayName ??
                  item.reported?.profile?.displayName ??
                  item.profile?.displayName ??
                  item.name ??
                  item.legalName ??
                  item.phone ??
                  item.id}
              </h3>
              <p>
                {item.description ??
                  item.profileDescription ??
                  item.reason ??
                  item.transactionId ??
                  item.category ??
                  item.method ??
                  item.user?.phone ??
                  "SocialConnect record"}
              </p>
              <small>
                {item.amount != null ? `${item.amount} points · ` : ""}
                {item.currencyAmountMinor != null ? `${item.currency ?? 'BDT'} ${(item.currencyAmountMinor/100).toFixed(2)} · ` : ""}
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleString()
                  : ""}
              </small>
            </div>
            <div className="recordActions">
              {tab === "users" && item.status === "ACTIVE" && (
                <>
                  <button
                    className="secondary"
                    onClick={() => {
                      const raw=window.prompt('Point adjustment. Use a negative number to debit.');if(raw===null)return;const amount=Number(raw);if(!Number.isInteger(amount)||amount===0)return window.alert('Enter a non-zero whole number.');const reason=window.prompt('Reason for this audited adjustment');if(!reason||reason.trim().length<5)return window.alert('A clear reason is required.');void action(`/admin/users/${item.id}/adjust-balance`,{amount,reason:reason.trim(),idempotencyKey:`console-${Date.now()}-${crypto.randomUUID()}`},'POST');
                    }}
                  >
                    Adjust balance
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      action(`/admin/users/${item.id}/status`, {
                        status: "SUSPENDED",
                      })
                    }
                  >
                    Suspend
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      action(
                        "/admin/restrictions",
                        {
                          userId: item.id,
                          type: "CALL",
                          reason: "Calling restricted by Trust & Safety review",
                        },
                        "POST",
                      )
                    }
                  >
                    Restrict calls
                  </button>
                </>
              )}
              {tab === "vendors" && (
                <>
                  <button
                    onClick={() =>
                      action(`/admin/vendors/${item.id}/status`, {
                        status: "APPROVED",
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      action(`/admin/vendors/${item.id}/status`, {
                        status: "MORE_INFO",
                        reason:
                          "Please provide clearer verification documents.",
                      })
                    }
                  >
                    More info
                  </button>
                </>
              )}
              {tab === "payments" && (
                <>
                  <button
                    onClick={() =>
                      action(`/payments/admin/${item.id}/approve`, {}, "POST")
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      action(
                        `/payments/admin/${item.id}/reject`,
                        { reason: "Rejected by Finance review" },
                        "POST",
                      )
                    }
                  >
                    Reject
                  </button>
                </>
              )}
              {tab === "withdrawals" && (
                <>
                  <button
                    onClick={() =>
                      action(`/admin/withdrawals/${item.id}/status`, {
                        status: "COMPLETED",
                      })
                    }
                  >
                    Complete
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      action(`/admin/withdrawals/${item.id}/status`, {
                        status: "REJECTED",
                        reason: "Rejected by Finance review",
                      })
                    }
                  >
                    Reject
                  </button>
                </>
              )}
              {tab === "reports" && (
                <button
                  onClick={() =>
                    action(`/admin/reports/${item.id}/status`, {
                      status: "RESOLVED",
                      resolution: "Reviewed and resolved by Trust & Safety",
                    })
                  }
                >
                  Resolve
                </button>
              )}
              {tab === "appeals" && (
                <>
                  <button
                    onClick={() =>
                      action(`/admin/appeals/${item.id}`, {
                        status: "ACCEPTED",
                        resolution:
                          "Appeal accepted after an independent Trust & Safety review. The related action will be reassessed.",
                      })
                    }
                  >
                    Accept
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      action(`/admin/appeals/${item.id}`, {
                        status: "REJECTED",
                        resolution:
                          "Appeal rejected after an independent review. The original decision remains in effect.",
                      })
                    }
                  >
                    Reject
                  </button>
                </>
              )}
              {tab === "fraud" && !item.reviewedAt && (
                <button
                  onClick={() =>
                    action(`/admin/fraud/${item.id}/resolve`, {
                      resolution: "Reviewed by operations",
                    })
                  }
                >
                  Mark reviewed
                </button>
              )}
              {tab === "restrictions" && !item.revokedAt && (
                <button
                  onClick={() =>
                    action(`/admin/restrictions/${item.id}/revoke`, {}, "PATCH")
                  }
                >
                  Revoke restriction
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
