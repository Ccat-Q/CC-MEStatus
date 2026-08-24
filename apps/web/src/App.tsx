import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AgentCommand, AuditEntry, DevicePolicy, NetworkStatus, PeripheralDevice, ResourceKind } from "@cc-mestatus/protocol";
import { api } from "./api";

type Tab = "overview" | "inventory" | "operations" | "devices" | "audit" | "settings";

const tabs: Array<[Tab, string]> = [
  ["overview", "总览"], ["inventory", "库存"], ["operations", "操作"],
  ["devices", "设备"], ["audit", "审计"], ["settings", "设置"]
];

function formatNumber(value: number | null | undefined): string {
  return value == null ? "—" : new Intl.NumberFormat("zh-CN").format(value);
}

function formatTime(value: number | undefined): string {
  return value ? new Date(value).toLocaleString("zh-CN") : "尚无数据";
}

function ErrorBanner({ message }: { message: string | null }) {
  return message ? <div className="banner error">{message}</div> : null;
}

export function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try { setStatus(await api.status()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  return <div className="shell">
    <aside>
      <div className="brand"><span className="brand-mark">ME</span><div><strong>Remote Console</strong><small>Applied Energistics 2</small></div></div>
      <nav>{tabs.map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className={`connection ${status?.connected ? "online" : "offline"}`}>
        <span />{status?.connected ? "代理在线" : "代理离线"}
      </div>
    </aside>
    <main>
      <header><div><p className="eyebrow">PRIMARY NETWORK</p><h1>{tabs.find(([id]) => id === tab)?.[1]}</h1></div><button className="secondary" onClick={() => void loadStatus()}>刷新状态</button></header>
      <ErrorBanner message={error} />
      {tab === "overview" && <Overview status={status} />}
      {tab === "inventory" && <Inventory />}
      {tab === "operations" && <Operations />}
      {tab === "devices" && <Devices />}
      {tab === "audit" && <Audit />}
      {tab === "settings" && <Settings />}
    </main>
  </div>;
}

function Overview({ status }: { status: NetworkStatus | null }) {
  const energyPercent = status?.energy?.stored != null && status.energy.capacity
    ? Math.min(100, status.energy.stored / status.energy.capacity * 100) : 0;
  return <>
    <section className="hero panel">
      <div><p className="eyebrow">NETWORK HEALTH</p><h2>{status?.connected ? "ME 网络已连接" : "等待游戏内代理"}</h2><p>最后心跳：{formatTime(status?.lastSeen)}</p></div>
      <div className={`orb ${status?.connected ? "live" : ""}`}><span>{status?.connected ? "LIVE" : "OFF"}</span></div>
    </section>
    <section className="metrics">
      <article className="panel"><span>储存能量</span><strong>{formatNumber(status?.energy?.stored)} AE</strong><div className="meter"><i style={{ width: `${energyPercent}%` }} /></div><small>容量 {formatNumber(status?.energy?.capacity)} AE</small></article>
      <article className="panel"><span>实时耗能</span><strong>{formatNumber(status?.energy?.usage)} AE/t</strong><small>来自 ME Bridge 快照</small></article>
      <article className="panel"><span>合成 CPU</span><strong>{formatNumber(status?.craftingCpus?.length)}</strong><small>{status?.craftingCpus ? "当前可见处理单元" : "当前 ME Bridge 版本不提供 CPU 列表"}</small></article>
      <article className="panel"><span>外围设备</span><strong>{status?.devices.length ?? 0}</strong><small>有线网络已发现</small></article>
    </section>
    <section className="panel detail-grid"><div><span>代理版本</span><strong>{status?.version ?? "—"}</strong></div><div><span>电脑 ID</span><strong>{status?.computerId ?? "—"}</strong></div><div><span>标签</span><strong>{status?.label ?? "未命名"}</strong></div><div><span>连接时间</span><strong>{formatTime(status?.connectedAt)}</strong></div></section>
  </>;
}

function Inventory() {
  const [kind, setKind] = useState<ResourceKind>("item");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const response = await api.inventory(kind);
      setItems(response.result.resources as Array<Record<string, unknown>>);
      setUpdatedAt(Date.now()); setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  };
  const filtered = useMemo(() => items.filter((item) => `${item.displayName ?? ""} ${item.name ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <section className="panel">
    <div className="toolbar"><div className="segmented">{(["item", "fluid", "gas"] as ResourceKind[]).map((value) => <button className={kind === value ? "active" : ""} onClick={() => setKind(value)} key={value}>{value}</button>)}</div><input placeholder="搜索名称或注册名" value={query} onChange={(event) => setQuery(event.target.value)} /><button onClick={() => void load()} disabled={loading}>{loading ? "加载中…" : "手动刷新"}</button></div>
    <ErrorBanner message={error} /><p className="muted">按需快照 · 更新时间：{formatTime(updatedAt)}</p>
    <div className="resource-list">{filtered.map((item, index) => <article key={`${String(item.fingerprint ?? item.name)}-${index}`}><div><strong>{String(item.displayName ?? item.name ?? "未知资源")}</strong><small>{String(item.name ?? "")}</small></div><b>{formatNumber(Number(item.amount ?? 0))}</b><span>{item.isCraftable ? "可合成" : "库存"}</span></article>)}{!loading && filtered.length === 0 && <div className="empty">点击“手动刷新”读取 ME 库存</div>}</div>
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
  useEffect(() => { void api.devices().then((value) => setPolicies(value.policies.filter((policy) => policy.writable))).catch(() => undefined); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setMessage(null);
    try {
      const command: AgentCommand = { action, resource, filter: { name, amount }, ...(action !== "craft" ? { target } : {}) };
      const prepared = await api.prepare(command);
      if (!window.confirm(`请再次确认：${prepared.summary}\n确认令牌将在 60 秒后失效。`)) return;
      await api.execute(prepared.token);
      setMessage("操作已由游戏内代理执行，结果已写入审计日志。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  return <section className="panel form-panel"><h2>受控写操作</h2><p className="muted">每次操作都经过云端限额、设备授权和一次性确认令牌校验。</p><ErrorBanner message={error} />{message && <div className="banner success">{message}</div>}
    <form onSubmit={(event) => void submit(event)}>
      <label>操作<select value={action} onChange={(event) => setAction(event.target.value as typeof action)}><option value="craft">请求合成</option><option value="import">导入 ME</option><option value="export">导出 ME</option></select></label>
      <label>资源类型<select value={resource} onChange={(event) => setResource(event.target.value as ResourceKind)}><option value="item">物品</option><option value="fluid">流体</option><option value="gas">气体</option></select></label>
      <label className="wide">注册名<input required placeholder="minecraft:iron_ingot" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>数量<input required type="number" min="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
      {action !== "craft" && <label>授权设备<select required value={target} onChange={(event) => setTarget(event.target.value)}><option value="">请选择</option>{policies.map((policy) => <option key={policy.name}>{policy.name}</option>)}</select></label>}
      <button className="danger wide" type="submit">准备并确认操作</button>
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
  return <section className="panel"><div className="section-title"><div><h2>外围设备</h2><p>全部设备可见；写权限、方向和设备限额必须显式配置。</p></div><button onClick={() => void load()}>重新发现</button></div><ErrorBanner message={error} /><div className="device-grid">{sorted.map((device) => {
    const policy = policies[device.name];
    return <article key={device.name}><div><strong>{device.name}</strong><small>{device.types.join(" · ")}</small></div><p>{device.methods.length} 个方法</p>
      <label><input type="checkbox" checked={policy?.favorite ?? false} onChange={() => void toggle(device, "favorite")} /> 常用置顶</label>
      <label><input type="checkbox" checked={policy?.writable ?? false} onChange={() => void toggle(device, "writable")} /> 允许物料写入</label>
      <label>方向<select value={policy?.direction ?? ""} onChange={(event) => void save(device, { direction: (event.target.value || null) as DevicePolicy["direction"] })}><option value="">外围设备名称</option>{["north","south","east","west","up","down","front","back","left","right","top","bottom"].map((direction) => <option key={direction}>{direction}</option>)}</select></label>
      <div className="device-limits">{(["item", "fluid", "gas"] as ResourceKind[]).map((resource) => {
        const key = `${resource}Limit` as "itemLimit" | "fluidLimit" | "gasLimit";
        return <label key={resource}>{resource} 限额<input type="number" min="1" placeholder="全局" value={policy?.[key] ?? ""} onChange={(event) => void save(device, { [key]: event.target.value ? Number(event.target.value) : null })} /></label>;
      })}</div>
    </article>;
  })}</div></section>;
}

function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.audit().then(setEntries).catch((reason) => setError(String(reason))); }, []);
  return <section className="panel"><h2>最近 100 次写操作</h2><ErrorBanner message={error} /><div className="audit-list">{entries.map((entry) => <article key={entry.id}><span className={entry.success ? "ok" : "bad"}>{entry.success ? "成功" : "失败"}</span><div><strong>{entry.action} · {entry.resource} · {entry.subject}</strong><small>{formatTime(entry.timestamp)} · {entry.actor}{entry.target ? ` · ${entry.target}` : ""}</small>{entry.error && <p>{entry.error}</p>}</div><b>{entry.amount ?? "—"}</b></article>)}{entries.length === 0 && <div className="empty">尚无审计记录</div>}</div></section>;
}

function Settings() {
  const [limits, setLimits] = useState<Record<ResourceKind, number>>({ item: 64, fluid: 1000, gas: 1000 });
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void api.settings().then((value) => setLimits(value.limits)); }, []);
  return <section className="panel form-panel"><h2>全局安全限额</h2><p className="muted">设备级限额可以覆盖这里的默认值。</p><form onSubmit={(event) => { event.preventDefault(); void api.saveSettings(limits).then(() => setMessage("设置已保存")); }}>
    {(["item", "fluid", "gas"] as ResourceKind[]).map((resource) => <label key={resource}>{resource}<input type="number" min="1" value={limits[resource]} onChange={(event) => setLimits({ ...limits, [resource]: Number(event.target.value) })} /></label>)}
    <button className="wide" type="submit">保存设置</button>{message && <div className="banner success wide">{message}</div>}
  </form></section>;
}
