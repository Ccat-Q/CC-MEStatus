import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AgentCommand, AuditEntry, DevicePolicy, NetworkStatus, PeripheralDevice, ResourceKind } from "@cc-mestatus/protocol";
import { api } from "./api";

type Tab = "overview" | "inventory" | "operations" | "devices" | "audit" | "settings";

const tabDescriptions: Record<Tab, string> = {
  overview: "网络运行状态与关键遥测",
  inventory: "按需读取物品、流体与气体快照",
  operations: "发起受限额保护的合成与转移",
  devices: "发现外围设备并管理写入授权",
  audit: "追踪每一次远程写操作",
  settings: "配置全局资源安全限额"
};

const tabs: Array<[Tab, string]> = [
  ["overview", "总览"], ["inventory", "库存"], ["operations", "操作"],
  ["devices", "设备"], ["audit", "审计"], ["settings", "设置"]
];

function tabFromHash(): Tab {
  const value = window.location.hash.slice(1);
  return tabs.some(([id]) => id === value) ? value as Tab : "overview";
}

function Icon({ name }: { name: Tab | "refresh" | "pulse" }) {
  const paths: Record<Tab | "refresh" | "pulse", React.ReactNode> = {
    overview: <><path d="M4 13h6V4H4v9Zm0 7h6v-3H4v3Zm10 0h6v-9h-6v9Zm0-13h6V4h-6v3Z" /></>,
    inventory: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 7 8 4 8-4M4 12l8 4 8-4M4 17l8 4 8-4" /></>,
    operations: <><path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4" /></>,
    devices: <><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 9h6v6H9zM9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4" /></>,
    audit: <><path d="M9 4h6l1 2h3v15H5V6h3l1-2Z" /><path d="m8 13 2.5 2.5L16 10" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 8.95 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.34 5.66" /><path d="M20 4v7h-7" /></>,
    pulse: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function formatNumber(value: number | null | undefined): string {
  return value == null ? "—" : new Intl.NumberFormat("zh-CN").format(value);
}

function formatTime(value: number | undefined): string {
  return value ? new Date(value).toLocaleString("zh-CN") : "尚无数据";
}

function resourceTitle(item: Record<string, unknown>): string {
  const displayName = typeof item.displayName === "string" ? item.displayName.trim() : "";
  if (displayName && !/^[?\s�]+$/.test(displayName)) return displayName;
  const registryName = typeof item.name === "string" ? item.name : "";
  const path = registryName.includes(":") ? registryName.slice(registryName.indexOf(":") + 1) : registryName;
  const readable = path.replace(/[_-]+/g, " ").trim();
  return readable || registryName || "未知资源";
}

function ErrorBanner({ message }: { message: string | null }) {
  return message ? <div className="banner error" role="alert"><strong>读取失败</strong><span>{message}</span></div> : null;
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try { setStatus(await api.status()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);
  useEffect(() => { const syncTab = () => setTab(tabFromHash()); window.addEventListener("hashchange", syncTab); return () => window.removeEventListener("hashchange", syncTab); }, []);

  return <div className={`shell ${status?.connected ? "network-online" : "network-offline"}`}>
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <aside className="rail">
      <div className="brand"><span className="brand-mark"><b>ME</b><i /></span><div><strong>Remote Console</strong><small>PRIMARY NETWORK / 01</small></div></div>
      <div className="bus-track" aria-hidden="true"><i /><span /><span /><span /><span /><span /><span /></div>
      <nav aria-label="主要导航">{tabs.map(([id, label]) => <a href={`#${id}`} key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined}><Icon name={id} /><span>{label}</span></a>)}</nav>
      <div className={`connection ${status?.connected ? "online" : "offline"}`} role="status" aria-live="polite">
        <span className="status-dot" /><div><strong>{status?.connected ? "链路正常" : "链路中断"}</strong><small>{status?.connected ? `CC #${status.computerId ?? "—"}` : "等待代理重连"}</small></div>
      </div>
    </aside>
    <main id="main-content" tabIndex={-1}>
      <header className="topbar">
        <div className="page-heading"><div className="network-id"><span>ME://PRIMARY</span><i>{status?.connected ? "LIVE" : "OFFLINE"}</i></div><h1>{tabs.find(([id]) => id === tab)?.[1]}</h1><p>{tabDescriptions[tab]}</p></div>
        <button type="button" className="secondary refresh-button" onClick={() => void loadStatus()}><Icon name="refresh" /><span>刷新状态</span></button>
      </header>
      <ErrorBanner message={error} />
      <div className="page-stage">
        {tab === "overview" && <Overview status={status} />}
        {tab === "inventory" && <Inventory />}
        {tab === "operations" && <Operations />}
        {tab === "devices" && <Devices />}
        {tab === "audit" && <Audit />}
        {tab === "settings" && <Settings />}
      </div>
    </main>
  </div>;
}

function Overview({ status }: { status: NetworkStatus | null }) {
  const energyPercent = status?.energy?.stored != null && status.energy.capacity
    ? Math.min(100, status.energy.stored / status.energy.capacity * 100) : 0;
  return <>
    <section className="system-map panel">
      <div className="health-copy"><p className="eyebrow"><Icon name="pulse" /> NETWORK HEALTH</p><h2>{status?.connected ? "主网络运行正常" : "正在等待游戏内代理"}</h2><p>{status?.connected ? "ME Bridge 已建立加密链路，遥测可用。" : "请确认区块加载、HTTP 许可与代理启动状态。"}</p><div className="heartbeat"><span>最后心跳</span><time>{formatTime(status?.lastSeen)}</time></div></div>
      <div className={`network-schematic ${status?.connected ? "live" : ""}`} aria-label={status?.connected ? "ME 网络在线" : "ME 网络离线"}>
        <div className="core-node"><span>ME</span><small>CORE</small></div>
        <div className="schematic-line"><i /><i /><i /></div>
        <div className="schematic-nodes"><span><b>{formatNumber(status?.craftingCpus?.length)}</b><small>CPU</small></span><span><b>{status?.devices.length ?? 0}</b><small>DEVICE</small></span><span><b>{status?.version ?? "—"}</b><small>AGENT</small></span></div>
      </div>
    </section>
    <section className="metrics">
      <article className="panel metric energy-module"><div className="metric-label"><span>01</span><b>储存能量</b></div><strong>{formatNumber(status?.energy?.stored)} <small>AE</small></strong><div className="meter" aria-label={`能量 ${Math.round(energyPercent)}%`}><i style={{ width: `${energyPercent}%` }} /></div><footer><span>容量 {formatNumber(status?.energy?.capacity)} AE</span><b>{energyPercent ? `${Math.round(energyPercent)}%` : "—"}</b></footer></article>
      <article className="panel metric"><div className="metric-label"><span>02</span><b>实时耗能</b></div><strong>{formatNumber(status?.energy?.usage)} <small>AE/t</small></strong><footer><span>ME Bridge 快照</span><b>LOAD</b></footer></article>
      <article className="panel metric"><div className="metric-label"><span>03</span><b>合成 CPU</b></div><strong>{formatNumber(status?.craftingCpus?.length)}</strong><footer><span>{status?.craftingCpus ? "当前可见处理单元" : "当前版本未提供列表"}</span><b>CPU</b></footer></article>
      <article className="panel metric"><div className="metric-label"><span>04</span><b>外围设备</b></div><strong>{status?.devices.length ?? 0}</strong><footer><span>有线网络已发现</span><b>I/O</b></footer></article>
    </section>
    <section className="panel module-strip"><div><span>代理版本</span><strong>{status?.version ?? "—"}</strong></div><div><span>电脑 ID</span><strong>{status?.computerId ?? "—"}</strong></div><div><span>计算机标签</span><strong>{status?.label ?? "未命名"}</strong></div><div><span>本次连接</span><strong>{formatTime(status?.connectedAt)}</strong></div></section>
  </>;
}

function Inventory() {
  const [kind, setKind] = useState<ResourceKind>("item");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const load = async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const response = await api.inventory(kind);
      if (requestId !== requestSequence.current) return;
      setItems(response.result.resources as Array<Record<string, unknown>>);
      setUpdatedAt(Date.now()); setError(null);
    } catch (reason) {
      if (requestId === requestSequence.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };
  const filtered = useMemo(() => items.filter((item) => `${item.displayName ?? ""} ${item.name ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <section className="panel workspace-panel" aria-busy={loading}>
    <div className="toolbar"><div className="segmented" aria-label="资源类型">{(["item", "fluid", "gas"] as ResourceKind[]).map((value) => <button type="button" className={kind === value ? "active" : ""} aria-pressed={kind === value} onClick={() => { requestSequence.current++; setKind(value); setItems([]); setUpdatedAt(undefined); setError(null); setLoading(false); }} key={value}>{{ item: "物品", fluid: "流体", gas: "气体" }[value]}</button>)}</div><label className="search-field"><span>搜索库存</span><input name="inventory-search" autoComplete="off" placeholder="名称或注册名…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "正在读取…" : "读取快照"}</button></div>
    <ErrorBanner message={error} /><p className="snapshot-time"><span className="status-dot" />按需快照 <i /> 更新时间：{formatTime(updatedAt)}</p>
    <div className="resource-list">{filtered.map((item, index) => <article key={`${String(item.fingerprint ?? item.name)}-${index}`}><div><strong>{resourceTitle(item)}</strong><small>{String(item.name ?? "")}</small></div><b>{formatNumber(Number(item.amount ?? 0))}</b><span>{item.isCraftable ? "可合成" : "库存"}</span></article>)}{!loading && filtered.length === 0 && <div className="empty">点击“手动刷新”读取 ME 库存</div>}</div>
  </section>;
}

function Operations() {
  const [action, setAction] = useState<"craft" | "import" | "export">("craft");
  const [resource, setResource] = useState<ResourceKind>("item");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(1);
  const [target, setTarget] = useState("");
  const [policies, setPolicies] = useState<DevicePolicy[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { void api.devices().then((value) => setPolicies(value.policies.filter((policy) => policy.writable))).catch(() => undefined); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setMessage(null);
    try {
      const command: AgentCommand = { action, resource, filter: { name, amount }, ...(action !== "craft" ? { target } : {}) };
      const prepared = await api.prepare(command);
      if (!window.confirm(`请再次确认：${prepared.summary}\n确认令牌将在 60 秒后失效。`)) return;
      setSubmitting(true);
      await api.execute(prepared.token);
      setMessage("操作已由游戏内代理执行，结果已写入审计日志。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setSubmitting(false); }
  };
  return <section className="panel form-panel operations-panel"><div className="safety-heading"><span>WRITE QUEUE</span><div><h2>受控写操作</h2><p>每次操作都经过限额、设备授权和一次性确认令牌校验。</p></div></div><ErrorBanner message={error} />{message && <div className="banner success" role="status">{message}</div>}
    <form onSubmit={(event) => void submit(event)}>
      <label>操作<select name="action" autoComplete="off" value={action} onChange={(event) => setAction(event.target.value as typeof action)}><option value="craft">请求合成</option><option value="import">导入 ME</option><option value="export">导出 ME</option></select></label>
      <label>资源类型<select name="resource" autoComplete="off" value={resource} onChange={(event) => setResource(event.target.value as ResourceKind)}><option value="item">物品</option><option value="fluid">流体</option><option value="gas">气体</option></select></label>
      <label className="wide">注册名<input required name="subject" autoComplete="off" spellCheck={false} placeholder="例如 minecraft:iron_ingot…" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>数量<input required name="amount" autoComplete="off" inputMode="numeric" type="number" min="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
      {action !== "craft" && <label>授权设备<select required name="target" autoComplete="off" value={target} onChange={(event) => setTarget(event.target.value)}><option value="">请选择</option>{policies.map((policy) => <option key={policy.name}>{policy.name}</option>)}</select></label>}
      <button className="danger wide" type="submit" disabled={submitting}>{submitting ? "正在执行…" : "检查操作并继续确认"}</button>
    </form>
  </section>;
}

function Devices() {
  const [devices, setDevices] = useState<PeripheralDevice[]>([]);
  const [policies, setPolicies] = useState<Record<string, DevicePolicy>>({});
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { const value = await api.devices(); setDevices(value.devices); setPolicies(Object.fromEntries(value.policies.map((policy) => [policy.name, policy]))); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (device: PeripheralDevice, changes: Partial<DevicePolicy>) => {
    try {
      const saved = await api.saveDevice(device.name, { ...policies[device.name], ...changes });
      setPolicies((current) => ({ ...current, [device.name]: saved }));
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const toggle = async (device: PeripheralDevice, field: "favorite" | "writable") => {
    const current = policies[device.name];
    await save(device, { [field]: !current?.[field] });
  };
  const sorted = [...devices].sort((a, b) => Number(Boolean(policies[b.name]?.favorite)) - Number(Boolean(policies[a.name]?.favorite)) || a.name.localeCompare(b.name));
  return <section className="panel workspace-panel"><div className="section-title"><div><span className="section-kicker">WIRED PERIPHERALS</span><h2>外围设备</h2><p>全部设备可见；写权限、方向和设备限额必须显式配置。</p></div><button type="button" onClick={() => void load()}>重新发现</button></div><ErrorBanner message={error} /><div className="device-grid">{sorted.map((device) => {
    const policy = policies[device.name];
    return <article key={device.name}><div><strong>{device.name}</strong><small>{device.types.join(" · ")}</small></div><p>{device.methods.length} 个方法</p>
      <label><input name={`${device.name}-favorite`} type="checkbox" checked={policy?.favorite ?? false} onChange={() => void toggle(device, "favorite")} /> 常用置顶</label>
      <label><input name={`${device.name}-writable`} type="checkbox" checked={policy?.writable ?? false} onChange={() => void toggle(device, "writable")} /> 允许物料写入</label>
      <label>方向<select name={`${device.name}-direction`} autoComplete="off" value={policy?.direction ?? ""} onChange={(event) => void save(device, { direction: (event.target.value || null) as DevicePolicy["direction"] })}><option value="">外围设备名称</option>{["north","south","east","west","up","down","front","back","left","right","top","bottom"].map((direction) => <option key={direction}>{direction}</option>)}</select></label>
      <div className="device-limits">{(["item", "fluid", "gas"] as ResourceKind[]).map((resource) => {
        const key = `${resource}Limit` as "itemLimit" | "fluidLimit" | "gasLimit";
        return <label key={resource}>{resource} 限额<input name={`${device.name}-${resource}-limit`} autoComplete="off" inputMode="numeric" type="number" min="1" placeholder="使用全局值…" value={policy?.[key] ?? ""} onChange={(event) => void save(device, { [key]: event.target.value ? Number(event.target.value) : null })} /></label>;
      })}</div>
    </article>;
  })}</div></section>;
}

function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.audit().then(setEntries).catch((reason) => setError(String(reason))); }, []);
  return <section className="panel workspace-panel"><div className="section-title"><div><span className="section-kicker">AUDIT TRAIL</span><h2>最近 100 次写操作</h2></div></div><ErrorBanner message={error} /><div className="audit-list">{entries.map((entry) => <article key={entry.id}><span className={entry.success ? "ok" : "bad"}>{entry.success ? "成功" : "失败"}</span><div><strong>{entry.action} · {entry.resource} · {entry.subject}</strong><small>{formatTime(entry.timestamp)} · {entry.actor}{entry.target ? ` · ${entry.target}` : ""}</small>{entry.error && <p>{entry.error}</p>}</div><b>{entry.amount ?? "—"}</b></article>)}{entries.length === 0 && <div className="empty">尚无审计记录</div>}</div></section>;
}

function Settings() {
  const [limits, setLimits] = useState<Record<ResourceKind, number>>({ item: 64, fluid: 1000, gas: 1000 });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { void api.settings().then((value) => setLimits(value.limits)); }, []);
  return <section className="panel form-panel"><span className="section-kicker">SAFETY LIMITS</span><h2>全局安全限额</h2><p className="muted">设备级限额可以覆盖这里的默认值。</p><form onSubmit={(event) => { event.preventDefault(); setSaving(true); setMessage(null); void api.saveSettings(limits).then(() => setMessage("设置已保存")).finally(() => setSaving(false)); }}>
    {(["item", "fluid", "gas"] as ResourceKind[]).map((resource) => <label key={resource}>{resource}<input name={`${resource}-limit`} autoComplete="off" inputMode="numeric" type="number" min="1" value={limits[resource]} onChange={(event) => setLimits({ ...limits, [resource]: Number(event.target.value) })} /></label>)}
    <button className="wide" type="submit" disabled={saving}>{saving ? "正在保存…" : "保存设置"}</button>{message && <div className="banner success wide" role="status">{message}</div>}
  </form></section>;
}
