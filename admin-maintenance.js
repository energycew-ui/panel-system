/* =====================================================================
   ADMIN – MAINTENANCE TABS (PM Schedule, PM Records, Assets & RCM, Earthing)
   Uses pm-library.js and helpers from admin.html (downloadCSV, sortByDate).
   ===================================================================== */
let mAssets = {}, mRecords = [], mTpm = [], mPits = {}, mEarth = [];

function loadMaintenance() {
  db.ref("assets").on("value", s => { mAssets = s.val() || {}; fillAreaFilters(); refreshMaintenance(); });
  db.ref("pmRecords").on("value", s => {
    mRecords = [];
    Object.entries(s.val() || {}).forEach(([aid, recs]) =>
      Object.entries(recs || {}).forEach(([k, r]) => mRecords.push({ key: k, ...r, assetId: r.assetId || aid })));
    refreshMaintenance();
  });
  db.ref("tpmChecks").on("value", s => {
    mTpm = [];
    Object.entries(s.val() || {}).forEach(([aid, recs]) =>
      Object.entries(recs || {}).forEach(([k, r]) => mTpm.push({ key: k, ...r, assetId: r.assetId || aid })));
    refreshMaintenance();
  });
  db.ref("earthPits").on("value", s => { mPits = s.val() || {}; renderEarthing(); });
  db.ref("earthingReports").on("value", s => {
    mEarth = [];
    Object.entries(s.val() || {}).forEach(([pid, recs]) =>
      Object.entries(recs || {}).forEach(([k, r]) => mEarth.push({ key: k, ...r, pitId: r.pitId || pid })));
    renderEarthing();
  });
  renderStrategyInfo();
  renderRcmTables();
}

function refreshMaintenance() {
  renderPmKpis(); renderPmPlan(); renderCbmAlerts(); renderRedTags(); renderFollowUps();
  renderPmRecords(); renderAssets();
}

function fillAreaFilters() {
  const areas = [...new Set(Object.values(mAssets).map(a => a.area))].sort();
  ["pmArea", "asArea"].forEach(id => {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = '<option value="">All</option>' + areas.map(a => `<option>${esc(a)}</option>`).join("");
    sel.value = cur;
  });
}

/* ---------------- PM SCHEDULE ---------------- */
function pmJobs() {
  const jobs = [];
  Object.values(mAssets).forEach(a => {
    if (a.status === "Out of Service" || !CATEGORIES[a.category]) return;
    const active = activeLevels(a);
    Object.entries(a.pmStatus || {}).forEach(([L, s]) => {
      if (L === "D" || !s.nextDue || !active.includes(L)) return;
      jobs.push({ asset: a, level: L, nextDue: s.nextDue, lastDone: s.lastDone || "", days: daysUntil(s.nextDue) });
    });
  });
  // one work order per machine per date: the highest level covers the lower ones
  const merged = {};
  jobs.forEach(j => {
    const k = j.asset.id + "|" + j.nextDue;
    const m = merged[k];
    if (!m) { merged[k] = { ...j, covers: [] }; return; }
    if (LEVEL_ORDER.indexOf(j.level) > LEVEL_ORDER.indexOf(m.level)) {
      merged[k] = { ...j, covers: [...m.covers, m.level] };
    } else m.covers.push(j.level);
  });
  return Object.values(merged)
    .sort((x, y) => x.nextDue.localeCompare(y.nextDue) || LEVEL_ORDER.indexOf(y.level) - LEVEL_ORDER.indexOf(x.level));
}

function renderPmKpis() {
  const jobs = pmJobs();
  const overdue = jobs.filter(j => j.days < 0).length;
  const week = jobs.filter(j => j.days >= 0 && j.days <= 7).length;
  // compliance: PMs done on time in last 30 days ÷ (done in last 30 days + currently overdue)
  const since = addDays(ymd(new Date()), -30);
  const recent = mRecords.filter(r => r.date >= since);
  const onTime = recent.filter(r => !r.dueDate || r.date <= addDays(r.dueDate, 1)).length;
  const denom = recent.length + overdue;
  const compliance = denom ? Math.round(onTime / denom * 100) + "%" : "–";
  const alerts = latestPerAsset().filter(r => (r.cbmAlerts || []).length).length;
  const tags = mTpm.filter(t => t.tag === "red" && t.tagStatus !== "Closed").length;
  const active = Object.values(mAssets).filter(a => a.status !== "Out of Service");
  const cbmAssets = active.filter(a => ["CBM+PM", "PM+CBM"].includes(strategyFor(a).code)).length;
  const tiles = [
    ["green", "PM Compliance (30 days)", compliance, `${onTime} on time of ${denom || 0}`],
    ["red", "PM Overdue", overdue, "jobs past due date"],
    ["", "Due Next 7 Days", week, "plan for next Sunday"],
    ["red", "Condition Alerts", alerts, "machines with CBM readings out of limit"],
    ["red", "Open Red Tags", tags, "operator-reported abnormalities"],
    ["blue", "Machines on CBM", cbmAssets, `of ${active.length} active machines`]
  ];
  document.getElementById("pmKpis").innerHTML = tiles.map(([c, l, n, h]) => `
    <div class="kpi-tile ${c}"><div class="kpi-label">${l}</div><div class="kpi-number">${n}</div><div class="kpi-hint">${h}</div></div>`).join("");
}

function renderPmPlan() {
  const show = document.getElementById("pmShow").value;
  const area = document.getElementById("pmArea").value;
  const klass = document.getElementById("pmClass").value;
  const lvl = document.getElementById("pmLevel").value;
  const q = document.getElementById("pmSearch").value.trim().toLowerCase();
  const jobs = pmJobs().filter(j =>
    (show === "all" || (show === "overdue" ? j.days < 0 : j.days <= (show === "week" ? 7 : 30))) &&
    (!area || j.asset.area === area) && (!klass || critClass(j.asset.crit) === klass) && (!lvl || j.level === lvl) &&
    (!q || j.asset.name.toLowerCase().includes(q) || j.asset.id.toLowerCase().includes(q)));
  const el = document.getElementById("pmPlan");
  if (!jobs.length) { el.innerHTML = "<p>No PM jobs for this selection.</p>"; return; }
  el.innerHTML = `<table><tr><th>Due</th><th>Status</th><th>Machine</th><th>ID</th><th>Area</th><th>Class</th>
      <th>PM Level</th><th>Tasks</th><th>Strategy</th><th>Last Done</th><th>Action</th></tr>` +
    jobs.map(j => {
      const b = dueBadge(j.nextDue);
      return `<tr>
        <td style="white-space:nowrap;"><b>${esc(j.nextDue)}</b></td>
        <td><span class="badge ${b.cls}">${b.text}</span></td>
        <td><b>${esc(j.asset.name)}</b></td><td>${esc(j.asset.id)}</td><td>${esc(j.asset.area)}</td>
        <td>${critBadge(j.asset)}</td>
        <td>${esc(PM_LEVELS[j.level].name)}${j.covers.length ? `<br><small>includes ${j.covers.map(l => PM_LEVELS[l].short).join(", ")}</small>` : ""}</td>
        <td>${tasksFor(j.asset.category, j.level).length}</td>
        <td><small>${esc(strategyFor(j.asset).code)}</small></td>
        <td>${esc(j.lastDone || "–")}</td>
        <td style="white-space:nowrap;">
          <button class="secondary-btn" onclick="window.open('pm.html?id=${encodeURIComponent(j.asset.id)}&level=${j.level}','_blank')">Work Order</button>
          <button class="secondary-btn" onclick="window.open('machine.html?id=${encodeURIComponent(j.asset.id)}','_blank')">Machine</button>
        </td></tr>`;
    }).join("") + "</table>";
}

function printPmPlan() {
  const jobs = pmJobs().filter(j => j.days <= 7);
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>PM Plan</title><link rel="stylesheet" href="theme.css"></head><body class="doc"><div class="doc-sheet">
    <div style="text-align:center"><img src="logo.png" style="width:260px"><h1>Weekly PM Plan – week of ${toSunday(ymd(new Date()))}</h1></div>
    <table><tr><th>Due</th><th>Machine</th><th>ID</th><th>Area</th><th>Level</th><th>Assigned to</th><th>Done (date / sign)</th></tr>
    ${jobs.map(j => `<tr><td>${j.nextDue}${j.days < 0 ? " (OVERDUE)" : ""}</td><td>${esc(j.asset.name)}</td><td>${esc(j.asset.id)}</td>
      <td>${esc(j.asset.area)}</td><td>${PM_LEVELS[j.level].name}</td><td></td><td></td></tr>`).join("")}
    </table><p style="margin-top:30px">Supervisor Electrical: __________________ &nbsp;&nbsp; Supervisor Mechanical: __________________</p>
    </div><script>setTimeout(()=>print(),600)<\/script></body></html>`);
  w.document.close();
}

function latestPerAsset() {
  const map = {};
  mRecords.forEach(r => { if (!map[r.assetId] || (r.timestamp || "") > (map[r.assetId].timestamp || "")) map[r.assetId] = r; });
  return Object.values(map);
}

function renderCbmAlerts() {
  const rows = [];
  latestPerAsset().forEach(r => Object.entries(r.cbm || {}).forEach(([k, v]) => {
    const st = cbmStatus(k, v);
    if (st === "alert" || st === "danger") rows.push({ r, k, v, st });
  }));
  rows.sort((a, b) => (a.st === "danger" ? 0 : 1) - (b.st === "danger" ? 0 : 1));
  document.getElementById("cbmAlerts").innerHTML = rows.length
    ? `<table><tr><th>Machine</th><th>Parameter</th><th>Reading</th><th>Status</th><th>Date</th></tr>` +
      rows.map(x => `<tr><td>${esc(x.r.assetName)}</td><td>${esc(CBM_PARAMS[x.k]?.label || x.k)}</td>
        <td>${esc(x.v)} ${esc(CBM_PARAMS[x.k]?.unit || "")}</td><td>${statusBadgeCbm(x.st)}</td><td>${esc(x.r.date)}</td></tr>`).join("") + "</table>"
    : "<p>No condition alerts. All latest readings are within limits.</p>";
}

function renderRedTags() {
  const tags = mTpm.filter(t => t.tag === "red" && t.tagStatus !== "Closed")
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  document.getElementById("redTags").innerHTML = tags.length
    ? `<table><tr><th>Date</th><th>Machine</th><th>Problem</th><th>Raised by</th><th>Running?</th><th></th></tr>` +
      tags.map(t => `<tr><td style="white-space:nowrap;">${esc(t.date)}</td><td>${esc(t.assetName)}</td>
        <td>${esc(t.description)}<br><small>${esc((t.abnormal || []).join("; "))}</small></td>
        <td>${esc(t.operator)}</td><td>${esc(t.runSafe)}</td>
        <td><button class="secondary-btn" onclick="closeTag('${esc(t.assetId)}','${t.key}')">Close</button></td></tr>`).join("") + "</table>"
    : "<p>No open red tags.</p>";
}
function closeTag(aid, key) {
  const by = prompt("Closed by (name) and action taken:");
  if (!by) return;
  db.ref(`tpmChecks/${aid}/${key}`).update({ tagStatus: "Closed", closedBy: by, closedAt: new Date().toISOString() });
}

function renderFollowUps() {
  const list = mRecords.filter(r => r.followStatus === "Open").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  document.getElementById("followUps").innerHTML = list.length
    ? `<table><tr><th>Found on</th><th>Machine</th><th>Follow-up job</th><th>Found by</th><th></th></tr>` +
      list.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.assetName)}</td><td>${esc(r.followText)}</td><td>${esc(r.technician)}</td>
        <td><button class="secondary-btn" onclick="closeFollow('${esc(r.assetId)}','${r.key}')">Mark Done</button></td></tr>`).join("") + "</table>"
    : "<p>No open follow-up jobs.</p>";
}
function closeFollow(aid, key) {
  const by = prompt("Completed by (name) and remarks:");
  if (!by) return;
  db.ref(`pmRecords/${aid}/${key}`).update({ followStatus: "Closed", followClosedBy: by, followClosedAt: new Date().toISOString() });
}

/* ---------------- PM RECORDS ---------------- */
function renderPmRecords() {
  const qa = document.getElementById("prAsset").value.trim().toLowerCase();
  const qt = document.getElementById("prTech").value.trim().toLowerCase();
  const from = document.getElementById("prFrom").value, to = document.getElementById("prTo").value;
  let list = mRecords.filter(r =>
    (!qa || (r.assetName || "").toLowerCase().includes(qa) || (r.assetId || "").toLowerCase().includes(qa)) &&
    (!qt || (r.technician || "").toLowerCase().includes(qt)) &&
    (!from || r.date >= from) && (!to || r.date <= to));
  list = sortByDate(list, "sort_pr", r => (r.date || "") + "T" + (r.timeFrom || ""));
  const month = ymd(new Date()).slice(0, 7);
  const mins = r => { const [a, b] = [r.timeFrom, r.timeTo].map(t => t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null); return a != null && b != null && b > a ? b - a : 0; };
  document.getElementById("pmRecSummary").innerHTML = `
    <div class="summary-card"><div class="summary-title">Work Orders</div><div class="summary-value">${list.length}</div></div>
    <div class="summary-card"><div class="summary-title">This Month</div><div class="summary-value">${mRecords.filter(r => (r.date || "").startsWith(month)).length}</div></div>
    <div class="summary-card"><div class="summary-title">Defects Found</div><div class="summary-value">${list.reduce((s, r) => s + (r.notOk || 0), 0)}</div></div>
    <div class="summary-card"><div class="summary-title">PM Hours</div><div class="summary-value">${(list.reduce((s, r) => s + mins(r), 0) / 60).toFixed(1)}</div></div>`;
  const el = document.getElementById("pmRecTable");
  if (!list.length) { el.innerHTML = "<p>No PM work orders recorded yet. They appear here when technicians submit PM from the machine QR.</p>"; return; }
  el.innerHTML = `<table><tr><th>Date</th><th>Machine</th><th>Level</th><th>Technician</th><th>Not OK</th><th>CBM Alerts</th>
      <th>Condition</th><th>On Time</th><th>Action</th></tr>` +
    list.map(r => {
      const onTime = !r.dueDate || r.date <= addDays(r.dueDate, 1);
      const cond = r.condition === "Good" ? "badge-ok" : r.condition === "Critical" ? "badge-bad" : "badge-warn";
      return `<tr><td style="white-space:nowrap;">${esc(r.date)}<br><small>${esc(r.timeFrom)}–${esc(r.timeTo)}</small></td>
        <td><b>${esc(r.assetName)}</b><br><small>${esc(r.assetId)}</small></td>
        <td>${esc(PM_LEVELS[r.level]?.name || r.level)}</td><td>${esc(r.technician)}</td>
        <td>${r.notOk ? `<span class="badge badge-bad">${r.notOk}</span>` : "0"}</td>
        <td>${(r.cbmAlerts || []).length ? `<span class="badge badge-warn">${r.cbmAlerts.length}</span>` : "–"}</td>
        <td><span class="badge ${cond}">${esc(r.condition)}</span></td>
        <td>${onTime ? '<span class="badge badge-ok">Yes</span>' : '<span class="badge badge-bad">Late</span>'}</td>
        <td><button class="secondary-btn" onclick="window.open('pm_print.html?asset=${encodeURIComponent(r.assetId)}&id=${r.key}','_blank')">View / Print</button></td></tr>`;
    }).join("") + "</table>";
}

function exportPmCSV() {
  const rows = [["Date", "Machine ID", "Machine", "Level", "Technician", "Not OK", "CBM alerts", "Condition", "Findings", "Action", "Spares"]];
  mRecords.forEach(r => rows.push([r.date, r.assetId, r.assetName, r.level, r.technician, r.notOk || 0,
    (r.cbmAlerts || []).join(" "), r.condition, r.findings, r.action, r.spares]));
  downloadCSV("pm_records.csv", rows.map(r => r.map(csvCell).join(",")).join("\n"));
}
function csvCell(v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

/* ---------------- ASSETS & RCM ---------------- */
function renderStrategyInfo() {
  document.getElementById("strategyInfo").innerHTML = `
    <div class="overview-grid">
      <div>
        <h3 style="border:none;padding:0;margin:6px 0;">1 · Criticality (RCM)</h3>
        <p style="font-size:13.5px;margin:4px 0 8px;">Every machine is scored 1–5 on <b>S</b>afety, <b>P</b>roduction impact,
          repair <b>C</b>ost / MTTR and <b>F</b>ailure frequency (from 2025-26 fault data). Total 4–20:</p>
        <p style="font-size:13.5px;margin:0;">
          <span class="badge badge-bad">Class A ≥ 14</span> ${esc(CRIT_TEXT.A)}<br>
          <span class="badge badge-warn">Class B 9–13</span> ${esc(CRIT_TEXT.B)}<br>
          <span class="badge badge-info">Class C ≤ 8</span> ${esc(CRIT_TEXT.C)}</p>
        <h3 style="border:none;padding:0;margin:14px 0 6px;">2 · Strategy (RCM decision)</h3>
        <p style="font-size:13.5px;margin:0;">
          <b>Condition-Based + PM</b> – Class A machines whose failures give warning (vibration, heat, current, wear): measure and act before failure.<br>
          <b>PM + condition checks</b> – Class B: fixed-interval PM with key readings.<br>
          <b>Time-based PM</b> – Class C and machines without measurable warning signs.<br>
          <b>Run-to-Failure</b> – cheap tools with spares (bench grinder, power cutter) – monthly safety check only.<br>
          <b>Failure-finding</b> – hidden failures such as the standby generator: weekly test run.</p>
      </div>
      <div>
        <h3 style="border:none;padding:0;margin:6px 0;">3 · TPM pillars in this system</h3>
        <p style="font-size:13.5px;margin:0;">
          <b>Autonomous Maintenance</b> – operators scan the machine QR daily: Clean · Lubricate · Inspect · Tighten, red/white tags.<br>
          <b>Planned Maintenance</b> – weekly → yearly PM on Sunday shutdown windows, workload levelled.<br>
          <b>Focused Improvement</b> – RCA of top faults drives the tasks; MTBF per machine on its QR page.<br>
          <b>Safety</b> – LOTO and Permit to Work mandatory in every PM work order (crane work = work at height).<br>
          <b>Training</b> – RCM (4-11-26) and Condition Monitoring (11-11-26) trainings support the readings.</p>
        <h3 style="border:none;padding:0;margin:14px 0 6px;">4 · Machines that need condition-based monitoring</h3>
        <p style="font-size:13.5px;margin:0;">
          <b>Air compressors</b> – vibration, bearing &amp; discharge temperature, current, running hours.<br>
          <b>Overhead &amp; monorail cranes</b> – motor current, wire-rope wear (ISO 4309), brake lining, panel thermography.<br>
          <b>Molding machines</b> – hydraulic oil temperature &amp; pressure, pump vibration and current.<br>
          <b>Sand plant &amp; shakeout</b> – vibration motors (ISO 10816), bearing temperature, MCC thermography.<br>
          <b>Mullers / mixers</b> – gearbox vibration, motor current.<br>
          <b>Generator</b> – battery voltage, coolant temperature, alternator IR, running hours.<br>
          <b>Transformers &amp; earth pits</b> – already monitored (oil/IR/load, ≤ 5 Ω).</p>
      </div>
    </div>`;
}

function renderAssets() {
  const area = document.getElementById("asArea").value;
  const klass = document.getElementById("asClass").value;
  const strat = document.getElementById("asStrat").value;
  const q = document.getElementById("asSearch").value.trim().toLowerCase();
  const list = Object.values(mAssets).filter(a => CATEGORIES[a.category] &&
    (!area || a.area === area) && (!klass || (a.status !== "Out of Service" && critClass(a.crit) === klass)) &&
    (!strat || strategyFor(a).code === strat) &&
    (!q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)))
    .sort((a, b) => a.area.localeCompare(b.area) || (b.crit.S + b.crit.P + b.crit.C + b.crit.F) - (a.crit.S + a.crit.P + a.crit.C + a.crit.F));
  const el = document.getElementById("assetTable");
  if (!list.length) { el.innerHTML = "<p>No assets.</p>"; return; }
  el.innerHTML = `<table><tr><th>ID</th><th>Machine</th><th>Area</th><th>Type</th><th>S</th><th>P</th><th>C</th><th>F</th>
      <th>Score</th><th>Class</th><th>Strategy</th><th>CBM Parameters</th><th>DB</th><th>Status</th><th>Action</th></tr>` +
    list.map(a => {
      const c = a.crit, cat = CATEGORIES[a.category];
      const cbm = [...new Set(Object.values(cat.cbm).flat())].map(k => CBM_PARAMS[k].label.split(" (")[0]).join(", ");
      const oos = a.status === "Out of Service";
      return `<tr style="${oos ? "opacity:.55" : ""}">
        <td style="white-space:nowrap;"><b>${esc(a.id)}</b></td><td>${esc(a.name)}</td><td>${esc(a.area)}</td><td>${esc(cat.name)}</td>
        <td>${c.S}</td><td>${c.P}</td><td>${c.C}</td><td>${c.F}</td><td><b>${c.S + c.P + c.C + c.F}</b></td>
        <td>${oos ? "–" : critBadge(a)}</td><td><small>${esc(strategyFor(a).name)}</small></td>
        <td><small>${esc(cbm || "–")}</small></td><td>${esc(a.linkedDb || "–")}</td>
        <td><span class="badge ${oos ? "badge-bad" : a.status === "Fair" ? "badge-warn" : "badge-ok"}">${esc(a.status)}</span></td>
        <td style="white-space:nowrap;">
          <button class="secondary-btn" onclick="editAsset('${esc(a.id)}')">Edit</button>
          <button class="secondary-btn" onclick="window.open('qr_labels.html?type=assets&id=${encodeURIComponent(a.id)}','_blank')">QR</button>
        </td></tr>`;
    }).join("") + "</table>";
}

function editAsset(id) {
  const a = mAssets[id];
  const box = document.getElementById("assetEdit");
  const sel = (fid, v) => `<select id="${fid}">${[1, 2, 3, 4, 5].map(n => `<option ${n === v ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  box.style.display = "block";
  box.innerHTML = `<div class="filterBox" style="background:#fff6f5;border-color:#fd0000;">
    <div style="flex-basis:100%;font-weight:700;">Edit ${esc(a.name)} (${esc(a.id)})</div>
    <label class="f"><span>Safety (S)</span>${sel("eS", a.crit.S)}</label>
    <label class="f"><span>Production (P)</span>${sel("eP", a.crit.P)}</label>
    <label class="f"><span>Cost / MTTR (C)</span>${sel("eC", a.crit.C)}</label>
    <label class="f"><span>Failure freq. (F)</span>${sel("eF", a.crit.F)}</label>
    <label class="f"><span>Linked DB</span><input id="eDb" value="${esc(a.linkedDb || "")}" placeholder="e.g. DB-06"></label>
    <label class="f"><span>Status</span><select id="eSt">${["Excellent", "Good", "Fair", "Out of Service"].map(s =>
      `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <button class="primary-btn" onclick="saveAsset('${esc(id)}')">Save</button>
    <button class="secondary-btn" onclick="document.getElementById('assetEdit').style.display='none'">Cancel</button>
  </div>`;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}
function saveAsset(id) {
  const n = k => Number(document.getElementById(k).value);
  db.ref("assets/" + id).update({
    crit: { S: n("eS"), P: n("eP"), C: n("eC"), F: n("eF") },
    linkedDb: document.getElementById("eDb").value.trim().toUpperCase(),
    status: document.getElementById("eSt").value
  }).then(() => { document.getElementById("assetEdit").style.display = "none"; });
}

function exportAssetsCSV() {
  const rows = [["ID", "Machine", "Area", "Type", "S", "P", "C", "F", "Score", "Class", "Strategy", "Linked DB", "Status"]];
  Object.values(mAssets).forEach(a => { const c = a.crit; rows.push([a.id, a.name, a.area, CATEGORIES[a.category]?.name, c.S, c.P, c.C, c.F,
    c.S + c.P + c.C + c.F, critClass(c), strategyFor(a).name, a.linkedDb, a.status]); });
  downloadCSV("asset_register_rcm.csv", rows.map(r => r.map(csvCell).join(",")).join("\n"));
}

function renderRcmTables() {
  document.getElementById("rcmTables").innerHTML = Object.entries(CATEGORIES).map(([code, c]) => `
    <details style="margin:8px 0;border:1px solid var(--border);border-radius:10px;padding:10px 14px;background:#fff;">
      <summary style="cursor:pointer;font-weight:700;">${esc(c.name)} <small style="color:var(--muted);font-weight:500;">
        – ${c.rcm.length} failure modes · PM levels: ${c.levels.map(l => PM_LEVELS[l].short).join(", ")}</small></summary>
      <div class="table-wrap" style="margin-top:10px;max-height:none;"><table>
        <tr><th>Failure mode</th><th>Cause</th><th>Effect</th><th>Maintenance task</th><th>Type</th></tr>
        ${c.rcm.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td>
          <td><span class="badge badge-info">${esc(r[4])}</span></td></tr>`).join("")}
      </table></div>
    </details>`).join("");
}

/* ---------------- EARTHING ---------------- */
function renderEarthing() {
  const pits = Object.values(mPits).sort((a, b) => a.id.localeCompare(b.id));
  if (!pits.length) return;
  const latestRound = mEarth.reduce((m, r) => r.date > m ? r.date : m, "");
  const ns = pits.filter(p => p.lastResult === "NS").length;
  const maxPit = pits.reduce((m, p) => (p.lastReading > (m?.lastReading ?? -1) ? p : m), null);
  const nextDue = pits.map(p => p.nextDue).sort()[0];
  const nd = dueBadge(nextDue);
  document.getElementById("earthKpis").innerHTML = [
    ["", "Earth Pits", pits.length, "monitored points"],
    [ns ? "red" : "green", "Not Satisfactory", ns, ns ? "pits above 5.0 Ω" : "all pits ≤ 5.0 Ω"],
    ["blue", "Highest Reading", maxPit ? maxPit.lastReading + " Ω" : "–", maxPit ? maxPit.name : ""],
    [nd.cls === "badge-bad" ? "red" : "", "Next Test Due", nextDue || "–", nd.text + " · last round " + latestRound]
  ].map(([c, l, n, h]) => `<div class="kpi-tile ${c}"><div class="kpi-label">${l}</div><div class="kpi-number" style="font-size:24px">${n}</div><div class="kpi-hint">${esc(h)}</div></div>`).join("");

  // pit table with last 6 readings trend
  document.getElementById("pitTable").innerHTML = `<table><tr><th>Pit</th><th>Location</th><th>Last Reading</th><th>Result</th>
      <th>Last Tested</th><th>Next Due</th><th>Trend (last 6)</th><th>Action</th></tr>` +
    pits.map(p => {
      const hist = mEarth.filter(r => r.pitId === p.id).sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
      const b = dueBadge(p.nextDue);
      return `<tr><td style="white-space:nowrap;"><b>${esc(p.id)}</b></td><td>${esc(p.name)}</td><td style="white-space:nowrap;"><b>${esc(p.lastReading)} Ω</b></td>
        <td>${p.lastResult === "S" ? '<span class="badge badge-ok">S</span>' : '<span class="badge badge-bad">NS</span>'}</td>
        <td>${esc(p.lastDate)}</td><td>${esc(p.nextDue)} <span class="badge ${b.cls}">${b.text}</span></td>
        <td>${sparkline(hist.map(r => r.resistance))} <small>${hist.map(r => r.resistance).join(" · ")}</small></td>
        <td style="white-space:nowrap;"><button class="secondary-btn" onclick="window.open('earthing.html?id=${p.id}','_blank')">Test</button>
          <button class="secondary-btn" onclick="window.open('qr_labels.html?type=pits&id=${p.id}','_blank')">QR</button></td></tr>`;
    }).join("") + "</table>";

  // register matrix: one row per monthly inspection round (pits may be tested on different days)
  const rounds = [...new Set(mEarth.map(r => r.date.slice(0, 7)))].sort();
  if ((document.getElementById("sort_er") || {}).value !== "oldest") rounds.reverse();
  const monthName = m => new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  document.getElementById("earthRegister").innerHTML = `<table><tr><th>Round</th>${pits.map(p => `<th>${esc(p.name)}</th>`).join("")}
      <th>Tested By</th><th>Instrument</th><th>Soil / Weather</th></tr>` +
    rounds.map(m => {
      const rs = mEarth.filter(r => r.date.startsWith(m));
      const uniq = f => [...new Set(rs.map(f).filter(Boolean))];
      return `<tr><td style="white-space:nowrap;"><b>${esc(monthName(m))}</b></td>${pits.map(p => {
        const r = rs.find(x => x.pitId === p.id);
        return r ? `<td style="white-space:nowrap;${r.result === "NS" ? "background:#fde8e7;color:#b42318;font-weight:800;" : ""}">
            <b>${esc(r.resistance)} Ω</b><br><small>${esc(r.date.slice(8, 10) + "-" + r.date.slice(5, 7))} ${esc(r.timeFrom || "")}</small></td>` : "<td>–</td>";
      }).join("")}<td>${esc(uniq(r => r.testedBy).join(", "))}</td>
        <td><small>${esc(uniq(r => (r.instrument || "").split(" – ")[0]).join(", "))}</small></td>
        <td><small>${esc(uniq(r => r.soil).join(", "))}</small></td></tr>`;
    }).join("") + "</table>";

  const ca = mEarth.filter(r => r.observation || r.correctiveAction || r.result === "NS" || r.caStatus)
    .sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById("earthCA").innerHTML = ca.length
    ? `<table><tr><th>Date</th><th>Pit</th><th>Observation / Nonconformity</th><th>Corrective Action</th><th>Status</th></tr>` +
      ca.map(r => `<tr><td style="white-space:nowrap;">${esc(r.date)}</td><td>${esc(r.pitName)}</td><td>${esc(r.observation || (r.result === "NS" ? r.resistance + " Ω exceeds 5.0 Ω" : ""))}</td>
        <td>${esc(r.correctiveAction || "")}</td><td><span class="badge ${/closed/i.test(r.caStatus || "") ? "badge-ok" : "badge-bad"}">${esc(r.caStatus || "Open")}</span></td></tr>`).join("") + "</table>"
    : "<p>No corrective actions.</p>";
}

function sparkline(vals) {
  if (vals.length < 2) return "";
  const w = 70, h = 20, max = Math.max(EARTH_LIMIT, ...vals), min = 0;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - (v - min) / (max - min) * h).toFixed(1)}`).join(" ");
  const ly = (h - EARTH_LIMIT / max * h).toFixed(1);
  return `<svg width="${w}" height="${h}" style="vertical-align:middle"><line x1="0" x2="${w}" y1="${ly}" y2="${ly}" stroke="#fd0000" stroke-dasharray="2 2" stroke-width="1"/>
    <polyline points="${pts}" fill="none" stroke="#1a1410" stroke-width="1.6"/></svg>`;
}

function exportEarthCSV() {
  const rows = [["Date", "Pit", "Location", "Resistance (Ω)", "Result", "Tested By", "Instrument", "Observation", "Corrective Action", "Status"]];
  mEarth.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(r =>
    rows.push([r.date, r.pitId, r.pitName, r.resistance, r.result, r.testedBy, r.instrument, r.observation, r.correctiveAction, r.caStatus]));
  downloadCSV("earthing_register.csv", rows.map(r => r.map(csvCell).join(",")).join("\n"));
}
