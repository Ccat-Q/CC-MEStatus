import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentCommand, ResourceKind } from "@cc-mestatus/protocol";
import { api } from "./api";
import { EMPTY_ICON_INDEX, loadResourceIcons, resourceIconUrl } from "./resourceIcons";
import { EMPTY_TRANSLATIONS, loadResourceTranslations, resourceTitle } from "./resourceNames";

type InventoryItem = Record<string, unknown>;
const INVENTORY_PAGE_SIZE = 200;

function formatNumber(value: number | null | undefined): string {
  return value == null ? "—" : new Intl.NumberFormat("zh-CN").format(value);
}

function formatTime(value: number | undefined): string {
  return value ? new Date(value).toLocaleString("zh-CN") : "尚无数据";
}

function resourceIdentity(item: InventoryItem): string {
  return `${String(item.name ?? "")}\u0000${String(item.fingerprint ?? item.nbt ?? "")}`;
}

function ResourceIcon({ item, kind, icons, label, large = false }: { item: InventoryItem; kind: ResourceKind; icons: Record<string, string>; label: string; large?: boolean }) {
  const src = resourceIconUrl(item, kind, icons);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return <span className={`resource-icon${large ? " large" : ""}`} aria-hidden="true"><span className="resource-icon-fallback">{label.trim().slice(0, 1) || "?"}</span>{src && !failed && <img src={src} alt="" onError={() => setFailed(true)} />}</span>;
}

function ErrorBanner({ message }: { message: string | null }) {
  return message ? <div className="banner error" role="alert"><strong>读取失败</strong><span>{message}</span></div> : null;
}

export function InventoryPanel() {
  const [kind, setKind] = useState<ResourceKind>("item");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState(EMPTY_TRANSLATIONS);
  const [icons, setIcons] = useState(EMPTY_ICON_INDEX);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationAttempt, setTranslationAttempt] = useState(0);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [craftAmount, setCraftAmount] = useState(1);
  const [crafting, setCrafting] = useState(false);
  const [craftMessage, setCraftMessage] = useState<string | null>(null);
  const [craftError, setCraftError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    let active = true;
    void loadResourceTranslations()
      .then((value) => { if (active) { setTranslations(value); setTranslationError(null); } })
      .catch((reason) => { if (active) setTranslationError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [translationAttempt]);
  useEffect(() => {
    let active = true;
    void loadResourceIcons().then((value) => { if (active) setIcons(value); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const load = async (targetOffset = offset) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const response = await api.inventory(kind, targetOffset, INVENTORY_PAGE_SIZE);
      if (requestId !== requestSequence.current) return;
      setItems(response.result.resources as InventoryItem[]);
      setTotal(response.result.total);
      setOffset(response.result.offset);
      if (targetOffset !== offset) setSelected(null);
      setUpdatedAt(Date.now()); setError(null);
    } catch (reason) {
      if (requestId === requestSequence.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };
  const filtered = useMemo(() => items.filter((item) => `${resourceTitle(item, kind, translations)} ${item.name ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, kind, query, translations]);
  const selectedTitle = selected ? resourceTitle(selected, kind, translations) : "";
  const requestCraft = async () => {
    if (!selected || !selected.isCraftable || typeof selected.name !== "string") return;
    setCraftError(null); setCraftMessage(null); setCrafting(true);
    try {
      const command: AgentCommand = { action: "craft", resource: kind, filter: { name: selected.name, amount: craftAmount, ...(typeof selected.fingerprint === "string" ? { fingerprint: selected.fingerprint } : {}), ...(typeof selected.nbt === "string" ? { nbt: selected.nbt } : {}) } };
      const prepared = await api.prepare(command);
      if (!window.confirm(`请再次确认：${prepared.summary}\n确认令牌将在 60 秒后失效。`)) return;
      await api.execute(prepared.token);
      setCraftMessage(`已提交 ${formatNumber(craftAmount)} 个“${selectedTitle}”的合成请求，并写入审计日志。`);
    } catch (reason) {
      setCraftError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCrafting(false);
    }
  };

  const changeKind = (value: ResourceKind) => {
    requestSequence.current++;
    setKind(value); setItems([]); setTotal(0); setOffset(0); setQuery(""); setUpdatedAt(undefined); setError(null);
    setSelected(null); setCraftMessage(null); setCraftError(null); setLoading(false);
  };

  return <section className="panel workspace-panel" aria-busy={loading || crafting}>
    <div className="toolbar"><div className="segmented" aria-label="资源类型">{(["item", "fluid", "gas"] as ResourceKind[]).map((value) => <button type="button" className={kind === value ? "active" : ""} aria-pressed={kind === value} onClick={() => changeKind(value)} key={value}>{{ item: "物品", fluid: "流体", gas: "气体" }[value]}</button>)}</div><label className="search-field"><span>搜索当前页库存</span><input name="inventory-search" autoComplete="off" placeholder="搜索当前页名称或注册名…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "正在读取…" : "读取快照"}</button></div>
    {translationError && <div className="banner error translation-error" role="alert"><strong>中文名称加载失败</strong><span>{translationError}</span><button type="button" className="secondary" onClick={() => setTranslationAttempt((value) => value + 1)}>重试</button></div>}
    <ErrorBanner message={error} /><p className="snapshot-time"><span className="status-dot" />按需快照 <i /> 更新时间：{formatTime(updatedAt)}</p>
    <div className="inventory-layout"><div><div className="resource-list">{filtered.map((item) => { const title = resourceTitle(item, kind, translations); const identity = resourceIdentity(item); return <button type="button" className="resource-row" key={identity} aria-pressed={resourceIdentity(selected ?? {}) === identity} onClick={() => { setSelected(item); setCraftAmount(1); setCraftMessage(null); setCraftError(null); }}><ResourceIcon item={item} kind={kind} icons={icons} label={title} /><div><strong>{title}</strong><small>{String(item.name ?? "")}</small></div><b>{formatNumber(Number(item.amount ?? 0))}</b><span>{item.isCraftable ? "可合成" : "库存"}</span></button>; })}{!loading && filtered.length === 0 && <div className="empty">点击“读取快照”读取 ME 库存</div>}</div><nav className="pagination" aria-label="库存分页"><p aria-live="polite">{total === 0 ? "尚未读取库存" : `显示 ${offset + 1}–${Math.min(offset + items.length, total)}，共 ${total} 项`}</p><div><button type="button" disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - INVENTORY_PAGE_SIZE))}>上一页</button><button type="button" disabled={loading || offset + items.length >= total} onClick={() => void load(offset + INVENTORY_PAGE_SIZE)}>下一页</button></div></nav></div><aside className="inventory-detail" aria-live="polite">{selected ? <><div className="detail-header"><ResourceIcon item={selected} kind={kind} icons={icons} label={selectedTitle} large /><div><span className="section-kicker">RESOURCE DETAIL</span><h2>{selectedTitle}</h2><p>{kind === "item" ? "物品" : kind === "fluid" ? "流体" : "气体"} · {selected.isCraftable ? "可请求合成" : "仅库存"}</p></div></div><dl className="detail-grid"><div><dt>当前数量</dt><dd>{formatNumber(Number(selected.amount ?? 0))}</dd></div><div><dt>状态</dt><dd>{selected.isCraftable ? "可合成" : "库存"}</dd></div><div className="wide-detail"><dt>注册名</dt><dd><code>{String(selected.name ?? "")}</code></dd></div>{typeof selected.fingerprint === "string" && <div className="wide-detail"><dt>指纹</dt><dd><code>{selected.fingerprint}</code></dd></div>}</dl>{selected.isCraftable ? <div className="detail-craft"><label>请求数量<input aria-label="请求合成数量" type="number" min="1" inputMode="numeric" value={craftAmount} onChange={(event) => setCraftAmount(Math.max(1, Number(event.target.value) || 1))} /></label><button type="button" className="danger" disabled={crafting} onClick={() => void requestCraft()}>{crafting ? "正在提交…" : "一键请求合成"}</button></div> : <p className="detail-note">该资源当前没有可用的合成配方或合成能力。</p>}{craftError && <div className="banner error" role="alert"><strong>合成失败</strong><span>{craftError}</span></div>}{craftMessage && <div className="banner success" role="status">{craftMessage}</div>}</> : <div className="detail-empty"><span>SELECT RESOURCE</span><h2>查看资源详情</h2><p>点击左侧任意资源，查看精确注册名、库存数量与合成状态。</p></div>}</aside></div>
  </section>;
}
