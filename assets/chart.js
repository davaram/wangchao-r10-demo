
const NS = "http://www.w3.org/2000/svg";
const W = 640, H = 200, P = {l: 40, r: 12, t: 12, b: 24};
const COLORS = {warning: "#c27c0e", critical: "#b42318"};
const models = {};
function bj(ts) { return new Date(ts * 1000).toLocaleString("zh-CN", {timeZone: "Asia/Shanghai", hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"}); }
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function fmt(v, unit) { return unit === "%" ? v.toFixed(1) + "%" : v.toFixed(1); }
function toTs(t) { if (typeof t === "number") return t > 1e12 ? Math.round(t / 1000) : t; return Math.round(Date.parse(t) / 1000); }

function draw(host, chart) {
  const pts = chart.series[0].points;
  const r0 = Date.parse(chart.range.from) / 1000, r1 = Date.parse(chart.range.to) / 1000;
  const vals = pts.map(p => p.v);
  const near = chart.thresholds.map(t => t.value).filter(v => v <= Math.max(...vals) * 1.25 + 1);
  let lo = Math.min(...vals), hi = Math.max(...vals, ...near);
  lo = Math.max(0, lo - (hi - lo) * 0.1); hi = hi + (hi - lo) * 0.08 + 0.1;
  const x = ts => P.l + (ts - r0) / (r1 - r0) * (W - P.l - P.r);
  const y = v => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);
  const svg = el("svg", {viewBox: `0 0 ${W} ${H}`, "data-chart": chart.chartId}, host);
  for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; el("line", {x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), stroke: "#eee7da"}, svg); const tx = el("text", {x: 4, y: y(v) + 4, "font-size": 10, fill: "#7a6f63"}, svg); tx.textContent = chart.unit === "%" ? v.toFixed(0) : v.toFixed(1); }
  for (let i = 0; i <= 4; i++) { const ts = r0 + (r1 - r0) * i / 4; const tx = el("text", {x: x(ts), y: H - 6, "font-size": 10, fill: "#7a6f63", "text-anchor": "middle"}, svg); tx.textContent = bj(ts).slice(-5); }
  const thr = chart.thresholds.map(t => {
    const placement = t.value > hi ? "edge-top" : (t.value < lo ? "edge-bottom" : "inline");
    if (placement === "inline") { el("line", {x1: P.l, x2: W - P.r, y1: y(t.value), y2: y(t.value), stroke: COLORS[t.level], "stroke-dasharray": "5 4", "stroke-width": 1.2}, svg); }
    const tx = el("text", {x: W - P.r - 2, y: placement === "inline" ? y(t.value) - 3 : (placement === "edge-top" ? P.t + 9 + (t.level === "critical" ? 0 : 11) : H - P.b - 3), "font-size": 10, fill: COLORS[t.level], "text-anchor": "end"}, svg);
    tx.textContent = `${t.level === "critical" ? "严重" : "警告"} ${chart.unit === "%" ? t.value + "%" : t.value.toFixed(1)}${placement === "edge-top" ? " ↑" : placement === "edge-bottom" ? " ↓" : ""}`;
    return {...t, placement};
  });
  chart.gaps.forEach(g => { const a = x(toTs(g.from)), b = x(toTs(g.to)); el("rect", {x: a, y: P.t, width: Math.max(1, b - a), height: H - P.t - P.b, fill: "#9a9086", opacity: 0.15}, svg); });
  let seg = [], prev = null; const segs = [];
  pts.forEach(p => { if (prev && p.ts - prev.ts > 300) { segs.push(seg); seg = []; } seg.push(p); prev = p; });
  if (seg.length) segs.push(seg);
  segs.forEach(s => el("path", {d: s.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" "), fill: "none", stroke: "#2f6f8f", "stroke-width": 1.6}, svg));
  pts.forEach(p => { if (p.breach !== "none") el("circle", {cx: x(p.ts), cy: y(p.v), r: 2.8, fill: COLORS[p.breach], "data-breach": p.breach}, svg); });
  const cursor = el("line", {y1: P.t, y2: H - P.b, stroke: "#241f1a", "stroke-opacity": .35, visibility: "hidden"}, svg);
  const tip = document.createElement("div"); tip.className = "tip"; host.appendChild(tip);
  const tooltipAt = t => { const ts = toTs(t); let best = null, d = Infinity; pts.forEach(p => { const dd = Math.abs(p.ts - ts); if (dd < d) { d = dd; best = p; } }); if (!best || d > 150) return null; return {time: best.t, value: best.v, breach: best.breach, state: best.state, relation: {...best.relation}}; };
  const show = ev => {
    const rect = svg.getBoundingClientRect(); const cx = ev.clientX;
    const vx = (cx - rect.left) / rect.width * W; const ts = r0 + (vx - P.l) / (W - P.l - P.r) * (r1 - r0);
    let best = pts[0], d = Infinity; pts.forEach(p => { const dd = Math.abs(p.ts - ts); if (dd < d) { d = dd; best = p; } });
    cursor.setAttribute("x1", x(best.ts)); cursor.setAttribute("x2", x(best.ts)); cursor.setAttribute("visibility", "visible");
    tip.innerHTML = `${bj(best.ts)}（北京时间）<br>值 <b>${fmt(best.v, chart.unit)}</b> · breach <b>${best.breach}</b> · state <b>${best.state}</b><br>${best.relation.text}`;
    tip.style.display = "block"; const left = Math.min(rect.width - 230, Math.max(4, cx - rect.left + 12)); tip.style.left = left + "px"; tip.style.top = "30px";
  };
  svg.addEventListener("pointerdown", ev => { try { svg.setPointerCapture(ev.pointerId); } catch (e) {} show(ev); }); svg.addEventListener("pointermove", show);
  svg.addEventListener("pointerleave", ev => { if (ev.pointerType === "mouse") { tip.style.display = "none"; cursor.setAttribute("visibility", "hidden"); } });
  svg.addEventListener("contextmenu", ev => ev.preventDefault());
  const model = {chartId: chart.chartId, machine: chart.machine, metric: chart.metric, unit: chart.unit, resolution: chart.resolution, range: chart.range,
    viewport: {width: Math.round(svg.getBoundingClientRect().width), height: Math.round(svg.getBoundingClientRect().height)},
    series: [{kind: "mean", style: "solid", points: pts.map(p => ({t: p.t, v: p.v, breach: p.breach}))}],
    thresholds: thr, markers: chart.markers, gaps: chart.gaps, legend: [{label: "均值", kind: "mean"}, {label: "阈值", kind: "threshold"}, {label: "告警点", kind: "marker"}],
    tooltipFields: ["time", "value", "breach", "state", "relation"]};
  models[chart.chartId] = {renderModel: () => JSON.parse(JSON.stringify(model)), tooltipAt};
}


function renderMachines(data, root) {
  data.machines.forEach(m => {
    const box = document.createElement("section"); box.className = "machine";
    box.innerHTML = `<h2>${m.name} <small>${m.role} · ${m.cores} 核</small></h2><div class="grid"></div><div class="ev"></div>`;
    root.appendChild(box);
    m.charts.forEach(c => { const host = document.createElement("div"); host.className = "chart"; host.innerHTML = `<h3>${c.label}</h3>`; box.querySelector(".grid").appendChild(host); draw(host, c); });
    const evs = m.events.map(e => `${bj(e.slot)} ${e.rule} ${e.kind}→${e.level}${e.notify ? "" : "（不推送）"}`);
    box.querySelector(".ev").textContent = evs.length ? "事件：" + evs.join(" ｜ ") : "事件：无";
  });
}
