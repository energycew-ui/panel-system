/* =====================================================================
   ADMIN – WORK PLAN TAB  (HOD issues plan → supervisor executes → review)
   Uses workplan-lib.js, pm-library.js.
   ===================================================================== */
let wpPlans = {}, wpData = null, wpCurrent = null, wpManual = [];

function loadWorkPlans() {
  db.ref("workPlans").on("value", s => { wpPlans = s.val() || {}; wpRefreshProgress(); wpFillTargets(); });
  wpFillAddForm();
  wpDeptChanged();   // apply department defaults (Gemba is a mechanical-plan item)
  document.querySelector('.wpMod[value="gemba"]').addEventListener("change", wpGembaToggle);
  ["gembaD1", "gembaD2"].forEach(id => document.getElementById(id).addEventListener("change", () => { if (wpCurrent) wpGenerate(); }));
  // changing which reports are included rebuilds the plan straight away;
  // a LUX-only plan goes to its project owner (Mansab Ali)
  document.querySelectorAll(".wpMod").forEach(c => c.addEventListener("change", () => {
    const mods = [...document.querySelectorAll(".wpMod:checked")].map(x => x.value);
    const to = document.getElementById("wpTo2");
    const dept = WP_DEPTS[document.getElementById("wpDept").value];
    if (mods.length === 1 && mods[0] === "lux") to.value = WP_MODULES.lux.owner;
    else if (to.value === WP_MODULES.lux.owner) to.value = dept.to;
    if (wpCurrent) wpGenerate();
  }));
  document.getElementById("wpPeriod").addEventListener("change", () => { if (wpCurrent) wpGenerate(); });
}

async function wpEnsureData(force) {
  if (!wpData || force) wpData = await loadWPData();
  return wpData;
}

// switching department sets the HOD, receiver and which reports apply
function wpDeptChanged() {
  const d = WP_DEPTS[document.getElementById("wpDept").value];
  document.getElementById("wpBy").value = d.hod;
  document.getElementById("wpTo2").value = d.to;
  document.querySelectorAll(".wpMod").forEach(c => {
    const ok = d.mods.includes(c.value);
    c.disabled = !ok;
    c.checked = ok && (d.defaultMods.includes(c.value) || c.checked);
    c.parentElement.style.opacity = ok ? "1" : ".4";
  });
  wpCurrent = null;
  wpManual = [];
  wpRenderManual();
  wpGembaToggle();
  document.getElementById("wpHead").innerHTML = "";
  document.getElementById("wpSummary").innerHTML = "";
  document.getElementById("wpTable").innerHTML = "<p>Choose a period and press Generate Plan.</p>";
}

function wpPeriodChanged() {
  const custom = document.getElementById("wpPeriod").value === "custom";
  document.querySelectorAll(".wp-custom").forEach(el => el.style.display = custom ? "" : "none");
}

async function wpGenerate() {
  const dept = document.getElementById("wpDept").value;
  const mods = [...document.querySelectorAll(".wpMod:checked")].map(c => c.value).filter(m => WP_DEPTS[dept].mods.includes(m));
  if (!mods.length) return alert("Select at least one report to include.");
  const p = periodRange(document.getElementById("wpPeriod").value,
                        document.getElementById("wpFrom").value, document.getElementById("wpTo").value, dept);
  document.getElementById("wpTable").innerHTML = "<p>Building plan…</p>";
  const data = await wpEnsureData(true);
  const gembaDates = ["week", "nextweek", "custom"].includes(p.type)
    ? [document.getElementById("gembaD1").value, document.getElementById("gembaD2").value].filter(d => d && d >= p.from && d <= p.to)
    : [];
  const tasks = buildTasks(data, mods, p.from, p.to, dept, { gembaDates });
  // HOD-added tasks stay in the plan when it is regenerated
  wpManual.forEach(m => tasks.push(hodTask(m, data, dept)));
  const allMods = wpManual.length ? [...mods, "hod"] : mods;
  wpCurrent = { ...p, id: p.id + modsSuffix(dept, mods), dept, mods: allMods, tasks: sortTasks(tasks) };
  wpRender(wpCurrent);
}

/* ---------------- Gemba walk days (HOD picks each week) ---------------- */
function wpGembaToggle() {
  const on = document.querySelector('.wpMod[value="gemba"]').checked && !document.querySelector('.wpMod[value="gemba"]').disabled;
  const box = document.getElementById("gembaDays");
  box.style.display = on ? "flex" : "none";
  if (on && !document.getElementById("gembaD1").value) {
    const p = periodRange(document.getElementById("wpPeriod").value === "nextweek" ? "nextweek" : "week");
    document.getElementById("gembaD1").value = addDays(p.from, 1);   // Tuesday
    document.getElementById("gembaD2").value = addDays(p.from, 3);   // Thursday
  }
}

/* ---------------- HOD add-task ---------------- */
async function wpFillAddForm() {
  const assets = (await db.ref("assets").once("value")).val() || {};
  const byArea = {};
  Object.values(assets).filter(a => a.status !== "Out of Service" && CATEGORIES[a.category])
    .forEach(a => (byArea[a.area] = byArea[a.area] || []).push(a));
  document.getElementById("addAsset").innerHTML = Object.keys(byArea).sort().map(area =>
    `<optgroup label="${esc(area)}">` + byArea[area].sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))
      .map(a => `<option value="${esc(a.id)}">${esc(a.name)} (${esc(a.id)})${onDemand(a) ? " · on demand" : ""}</option>`).join("") + "</optgroup>").join("");
  window._wpAssets = assets;
  wpAddAssetChanged();
  document.getElementById("addDate").value = ymd(new Date());
}
function wpAddKindChanged() {
  const m = document.getElementById("addKind").value === "machine";
  document.querySelectorAll(".add-machine").forEach(e => e.style.display = m ? "" : "none");
  document.querySelectorAll(".add-free").forEach(e => e.style.display = m ? "none" : "");
}
function wpAddAssetChanged() {
  const a = (window._wpAssets || {})[document.getElementById("addAsset").value];
  if (!a) return;
  document.getElementById("addLevel").innerHTML = formLevels(a).filter(l => l !== "D")
    .map(l => `<option value="${l}">${esc(levelName(a, l))}</option>`).join("");
}
function wpFillTargets() {
  const sel = document.getElementById("addTarget");
  const cur = sel.value;
  const recent = Object.values(wpPlans).filter(p => p.to >= ymd(new Date()))
    .sort((a, b) => (b.issuedAt || "").localeCompare(a.issuedAt || ""));
  sel.innerHTML = `<option value="">Plan being prepared (above)</option>` +
    recent.map(p => `<option value="${esc(p.id)}">Issued: ${esc(p.id)}</option>`).join("");
  sel.value = cur;
}
async function wpAddTask() {
  const kind = document.getElementById("addKind").value;
  const opt = {
    kind, due: document.getElementById("addDate").value, urgent: document.getElementById("addUrgent").checked,
    ref: document.getElementById("addAsset").value, level: document.getElementById("addLevel").value,
    text: document.getElementById("addText").value.trim(), area: document.getElementById("addArea").value.trim()
  };
  if (!opt.due) return alert("Choose the date.");
  if (kind === "free" && !opt.text) return alert("Describe the task.");
  const target = document.getElementById("addTarget").value;
  const data = await wpEnsureData(false);
  if (!target) {
    wpManual.push(opt);
    wpRenderManual();
    if (wpCurrent) await wpGenerate();
  } else {
    // add straight into an issued plan (urgent job mid-week)
    const plan = wpPlans[target];
    const t = hodTask(opt, data, plan.dept);
    const tasks = [...(plan.tasks || []), { ...t, items: t.items || [] }];
    const mods = [...new Set([...(plan.mods || []), "hod"])];
    await db.ref("workPlans/" + target).update({ tasks, mods });
    alert(`Task added to ${target}. Re-print the plan for the supervisor.`);
  }
  document.getElementById("addText").value = "";
  document.getElementById("addUrgent").checked = false;
}
function wpRenderManual() {
  document.getElementById("wpManualList").innerHTML = wpManual.length
    ? "<b>Added by HOD:</b> " + wpManual.map((m, i) => `<span class="badge ${m.urgent ? "badge-bad" : "badge-info"}" style="margin:3px;">
        ${esc(m.kind === "machine" ? (window._wpAssets[m.ref] || {}).name + " – " + PM_LEVELS[m.level].short + " PM" : m.text)} · ${esc(m.due.slice(8, 10) + "-" + m.due.slice(5, 7))}
        <a href="#" onclick="wpManual.splice(${i},1);wpRenderManual();if(wpCurrent)wpGenerate();return false;" style="color:inherit;margin-left:4px;">✕</a></span>`).join("")
    : "";
}

/* close free (non-form) tasks of an issued plan */
function wpCloseTasks(id) {
  const plan = wpPlans[id];
  const open = (plan.tasks || []).map((t, i) => ({ t, i })).filter(x => x.t.mod === "hod" && x.t.kind === "free" && !(plan.manualDone || {})[x.i]);
  if (!open.length) return alert("No open HOD tasks to close in this plan.");
  const ans = prompt("Which tasks are completed? Enter numbers separated by commas:\n\n" +
    open.map((x, n) => `${n + 1}. ${x.t.name} (${x.t.due})`).join("\n"));
  if (!ans) return;
  const upd = {};
  ans.split(",").map(s => parseInt(s.trim(), 10) - 1).filter(n => open[n]).forEach(n => upd[open[n].i] = ymd(new Date()));
  db.ref(`workPlans/${id}/manualDone`).update(upd);
}

function wpRender(plan) {
  const tasks = plan.tasks;
  document.getElementById("wpHead").innerHTML = `<p style="margin:6px 0 0;"><b>${esc(plan.id)}</b> · ${esc(WP_DEPTS[plan.dept || "E"].name)} · <b>${esc(modsTitle(plan.mods))}</b> · ${esc(plan.label)}
    · ${tasks.length} tasks${tasks.filter(t => t.overdue).length ? ` · <span class="badge badge-bad">${tasks.filter(t => t.overdue).length} overdue carried over</span>` : ""}</p>`;
  document.getElementById("wpSummary").innerHTML = WP_ORDER.filter(m => plan.mods.includes(m)).map(m => {
    const ts = tasks.filter(t => t.mod === m);
    return `<div class="summary-card"><div class="summary-title">${esc(WP_MODULES[m].name)}</div>
      <div class="summary-value">${ts.length}</div>
      <div style="font-size:12px;color:var(--muted)">${ts.filter(t => t.overdue).length} overdue</div></div>`;
  }).join("");
  if (!tasks.length) { document.getElementById("wpTable").innerHTML = "<p>Nothing due in this period.</p>"; return; }
  // yearly plans are long: show monthly summary + detail
  let html = "";
  if (plan.type === "year" || tasks.length > 400) {
    const months = [...new Set(tasks.map(t => t.due.slice(0, 7)))].sort();
    html += `<table><tr><th>Month</th>${WP_ORDER.filter(m => plan.mods.includes(m)).map(m => `<th>${esc(WP_MODULES[m].name)}</th>`).join("")}<th>Total</th></tr>` +
      months.map(mo => {
        const ts = tasks.filter(t => t.due.startsWith(mo));
        return `<tr><td><b>${new Date(mo + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b></td>
          ${WP_ORDER.filter(m => plan.mods.includes(m)).map(m => `<td>${ts.filter(t => t.mod === m).length}</td>`).join("")}<td><b>${ts.length}</b></td></tr>`;
      }).join("") + "</table><div style='height:14px'></div>";
  }
  html += `<table><tr><th>Due</th><th>Report</th><th>Item</th><th>Area / Location</th><th>Task</th><th>Responsible</th></tr>` +
    groupedRows(tasks.slice(0, 1500), 6, t => `<tr${t.overdue ? ' style="background:#fff3f2;"' : ""}>
      <td style="white-space:nowrap;"><b>${esc(t.due)}</b>${t.overdue ? '<br><span class="badge badge-bad">Overdue</span>' : ""}</td>
      <td>${esc(WP_MODULES[t.mod].name)}${t.urgent ? '<br><span class="badge badge-bad">URGENT</span>' : ""}</td>
      <td><b>${esc(t.name)}</b>${t.mod === "pm" || t.kind === "machine" ? `<br><small>${esc(t.ref)}</small>` : ""}</td>
      <td>${esc(t.area)}</td><td style="min-width:280px;">${taskCellHtml(t)}</td><td><small>${esc(wpResp(plan.dept, t.mod))}</small></td></tr>`) + "</table>";
  if (tasks.length > 1500) html += `<p>Showing first 1500 of ${tasks.length} tasks – the printed plan contains all.</p>`;
  document.getElementById("wpTable").innerHTML = html;
}

async function wpIssue() {
  await wpGenerate();   // always issue exactly what is selected now
  if (!wpCurrent) return;
  if (!wpCurrent.tasks.length) return alert("Nothing is due for the selected report(s) in this period – no plan issued.");
  const by = document.getElementById("wpBy").value.trim(), to = document.getElementById("wpTo2").value.trim();
  if (!by || !to) return alert("Enter 'Issued by' and 'Issued to'.");
  if (wpPlans[wpCurrent.id] && !confirm(`Plan ${wpCurrent.id} was already issued on ${wpPlans[wpCurrent.id].issuedAt.slice(0, 10)}. Re-issue and replace it?`)) return;
  const plan = {
    id: wpCurrent.id, dept: wpCurrent.dept, type: wpCurrent.type, label: wpCurrent.label, from: wpCurrent.from, to: wpCurrent.to,
    mods: wpCurrent.mods, issuedBy: by, issuedTo: to, issuedAt: new Date().toISOString(),
    tasks: wpCurrent.tasks.map(t => ({ mod: t.mod, ref: t.ref, name: t.name, area: t.area, detail: t.detail,
                                        due: t.due, overdue: !!t.overdue, level: t.level || "", items: t.items || [],
                                        kind: t.kind || "", urgent: !!t.urgent }))
  };
  await db.ref("workPlans/" + plan.id).set(plan);
  window.open("workplan_print.html?id=" + encodeURIComponent(plan.id), "_blank");
}

async function wpRefreshProgress() {
  const el = document.getElementById("wpIssued");
  const plans = Object.values(wpPlans).sort((a, b) => (b.issuedAt || "").localeCompare(a.issuedAt || ""));
  if (!plans.length) { el.innerHTML = "<p>No plan issued yet.</p>"; wpBanner([]); return; }
  const data = await wpEnsureData(true);
  const rows = plans.map(p => ({ p, pr: planProgress(p, data) }));
  el.innerHTML = `<table><tr><th>Plan</th><th>Department</th><th>Reports</th><th>Period</th><th>Issued</th><th>Issued To</th><th>Received</th><th>Progress</th>
      <th>Pending</th><th>Action</th></tr>` +
    rows.map(({ p, pr }) => {
      const color = pr.pct >= 90 ? "#12a150" : pr.pct >= 60 ? "#f0a800" : "#fd0000";
      return `<tr><td style="white-space:nowrap;"><b>${esc(p.id)}</b></td>
        <td><span class="badge ${p.dept === "M" ? "badge-warn" : "badge-info"}">${esc(WP_DEPTS[p.dept || "E"].name)}</span></td>
        <td><small>${esc(modsTitle(p.mods))}</small></td><td>${esc(p.label)}</td>
        <td style="white-space:nowrap;">${esc(p.issuedAt.slice(0, 10))}<br><small>${esc(p.issuedBy.split(" – ")[0])}</small></td>
        <td>${esc(p.issuedTo)}</td>
        <td>${p.ack ? `<span class="badge badge-ok">✓ ${esc(p.ack.by)}</span><br><small>${esc(p.ack.at.slice(0, 10))}</small>`
                    : `<button class="secondary-btn" onclick="wpAck('${esc(p.id)}')">Mark received</button>`}</td>
        <td style="min-width:150px;"><div style="background:#efebe5;border-radius:6px;height:10px;overflow:hidden;">
            <div style="width:${pr.pct}%;background:${color};height:100%;"></div></div>
          <small><b>${pr.pct}%</b> · ${pr.done}/${pr.total} done</small></td>
        <td>${pr.pending}${pr.overdue ? ` <span class="badge badge-bad">${pr.overdue} late</span>` : ""}</td>
        <td style="white-space:nowrap;">
          <button class="secondary-btn" onclick="window.open('workplan_print.html?id=${encodeURIComponent(p.id)}','_blank')">Print Plan</button>
          <button class="secondary-btn" onclick="window.open('workplan_print.html?id=${encodeURIComponent(p.id)}&review=1','_blank')">Review</button>
          ${(p.tasks || []).some(t => t.mod === "hod" && t.kind === "free") ? `<button class="secondary-btn" onclick="wpCloseTasks('${esc(p.id)}')">Close tasks</button>` : ""}
        </td></tr>`;
    }).join("") + "</table>";
  wpBanner(rows);
}

function wpAck(id) {
  const by = prompt("Received by (supervisor name):", (wpPlans[id].issuedTo || "").split(" – ")[0]);
  if (!by) return;
  db.ref(`workPlans/${id}/ack`).set({ by, at: new Date().toISOString() });
}

/* Overview banner: one strip per department – pushes each HOD to issue the weekly plan and shows progress */
function wpBanner(rows) {
  const el = document.getElementById("wpBanner");
  if (!el) return;
  el.innerHTML = Object.entries(WP_DEPTS).map(([code, d]) => {
    const wk = periodRange("week", "", "", code);
    // all plans of this department for the current week (one per report or combined)
    const week = rows.filter(r => (r.p.dept || "E") === code && r.p.from === wk.from && r.p.to === wk.to)
      .sort((a, b) => a.p.issuedAt.localeCompare(b.p.issuedAt));
    if (!week.length) {
      return `<div class="card" style="border-left:5px solid var(--brand);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <div><h2 style="margin:0;color:#b42318;">${esc(d.name)}: no work plan issued for this week</h2>
          <div style="color:var(--muted);font-size:13px;margin-top:4px;">${esc(wk.label)} – ${esc(d.hod.split(" – ")[0])} to issue the weekly plan to ${esc(d.to.split(" – ")[0])}.</div></div>
        <button class="primary-btn" style="background:var(--brand)!important;" onclick="wpOpenDept('${code}')">📝 Issue ${esc(d.name)} Plan</button></div>`;
    }
    const pr = week.reduce((s, r) => ({ total: s.total + r.pr.total, done: s.done + r.pr.done, overdue: s.overdue + r.pr.overdue }),
                           { total: 0, done: 0, overdue: 0 });
    pr.pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
    const color = pr.pct >= 90 ? "#12a150" : pr.pct >= 60 ? "#f0a800" : "#fd0000";
    const day = iso => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit" });
    const list = week.map(r => `<span class="badge ${r.p.ack ? "badge-ok" : "badge-warn"}" title="${esc(r.p.id)}">
        ${esc(modsTitle(r.p.mods))} · ${esc(day(r.p.issuedAt))} · ${r.pr.pct}%${r.p.ack ? " ✓" : ""}</span>`).join(" ");
    const notAck = week.filter(r => !r.p.ack).length;
    return `<div class="card" style="border-left:5px solid ${color};display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
      <div style="flex:1;min-width:240px;"><h2 style="margin:0;">${esc(d.name)} Work Plans · ${esc(wk.label)}</h2>
        <div style="color:var(--muted);font-size:13px;margin:4px 0 6px;">${week.length} plan(s) issued by ${esc(d.hod.split(" – ")[0])}
          ${notAck ? ` · <b style="color:#b42318">${notAck} not yet acknowledged</b>` : " · all received ✓"}</div>
        <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;">${list}</div>
        <div style="background:#efebe5;border-radius:6px;height:12px;overflow:hidden;"><div style="width:${pr.pct}%;background:${color};height:100%;"></div></div></div>
      <div style="text-align:right;"><div style="font-size:30px;font-weight:800;">${pr.pct}%</div>
        <div style="font-size:12.5px;color:var(--muted);">${pr.done} of ${pr.total} done${pr.overdue ? ` · <b style="color:#b42318">${pr.overdue} late</b>` : ""}</div>
        <button class="secondary-btn" style="margin-top:6px;" onclick="goTab('tab-workplan')">Open plan</button></div></div>`;
  }).join("");
}
function wpOpenDept(code) {
  goTab("tab-workplan");
  document.getElementById("wpDept").value = code;
  wpDeptChanged();
  document.getElementById("wpPeriod").value = "week";
  wpPeriodChanged();
}
