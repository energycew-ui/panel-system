/* =====================================================================
   WORK PLAN – what is due in a period across DB inspection, earthing,
   LUX, preventive maintenance (and transformers), and whether it was done.
   Shared by admin (Work Plan tab) and workplan_print.html.
   Needs pm-library.js loaded first.
   ===================================================================== */

const WP_MODULES = {
  db:    { name: "DB Inspection",           days: 30, resp: "Fazal Maqsood (Supervisor Electrical)" },
  earth: { name: "Earthing Inspection",     days: 30, resp: "Fazal Maqsood (Supervisor Electrical)" },
  lux:   { name: "LUX Monitoring",          days: 30, resp: "Mansab Ali (Asst. Supervisor Electrical) – LUX project owner",
           owner: "Mansab Ali – Asst. Supervisor Electrical" },
  pm:    { name: "Preventive Maintenance",  days: 0,  resp: "Fazal Maqsood (Elec.) / Aziz Ur Rehman (Mech.)" },
  tr:    { name: "Transformer Inspection",  days: 60, resp: "Fazal Maqsood (Supervisor Electrical)" }
};
const WP_ORDER = ["pm", "db", "earth", "lux", "tr"];

/* Each department issues its own plan: HOD → supervisor / foreman */
const WP_MOD_CODE = { pm: "PM", db: "DB", earth: "EARTH", lux: "LUX", tr: "TR" };
// plans for a single report (or a custom mix) get their own number, e.g. WP-2026-W46-TR
function modsSuffix(dept, mods) {
  const def = WP_DEPTS[dept || "E"].defaultMods;
  const same = mods.length === def.length && def.every(m => mods.includes(m));
  return same ? "" : "-" + WP_ORDER.filter(m => mods.includes(m)).map(m => WP_MOD_CODE[m]).join("-");
}
function modsTitle(mods) { return WP_ORDER.filter(m => (mods || []).includes(m)).map(m => WP_MODULES[m].name).join(" + "); }

const WP_DEPTS = {
  E: { name: "Electrical", suffix: "", defaultMods: ["pm", "db", "earth"],   // LUX is Mansab Ali's own project
       hod: "Engr Touseef Ghalib – Deputy Manager Electrical (HOD)",
       to: "Fazal Maqsood – Supervisor Electrical",
       mods: ["pm", "db", "earth", "lux", "tr"], disc: "E",
       resp: { pm: "Fazal Maqsood (Supervisor Electrical) – electrical items" } },
  M: { name: "Mechanical", suffix: "-MECH", defaultMods: ["pm"],
       hod: "Engr Ahtasham Khurshid – Deputy Manager Mechanical (HOD)",
       to: "Aziz Ur Rehman – Mechanical Foreman",
       mods: ["pm"], disc: "M",
       resp: { pm: "Aziz Ur Rehman (Mechanical Foreman) – mechanical items" } }
};
function wpResp(dept, mod) { return (WP_DEPTS[dept || "E"].resp || {})[mod] || WP_MODULES[mod].resp; }
// PM checklist items for one discipline (E or M); safety items go with both, marked "(Safety)"
function discTasks(category, level, disc) {
  return tasksFor(category, level).filter(t => t.d === disc || t.d === "S")
    .map(t => (t.d === "S" ? "(Safety) " : "") + t.text);
}

/* ---------------- periods (weeks run Monday → Sunday) ---------------- */
function mondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}
function isoWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const y = d.getFullYear(), jan4 = new Date(y, 0, 4);
  return { year: y, week: 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7) };
}
function periodRange(type, cFrom, cTo, dept) {
  const r = periodRangeBase(type, cFrom, cTo);
  r.id += WP_DEPTS[dept || "E"].suffix;
  return r;
}
function periodRangeBase(type, cFrom, cTo) {
  const today = ymd(new Date());
  const fmt = s => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  let from, to, id, label;
  if (type === "week" || type === "nextweek") {
    from = mondayOf(type === "week" ? today : addDays(today, 7));
    to = addDays(from, 6);
    const w = isoWeek(from);
    id = `WP-${w.year}-W${String(w.week).padStart(2, "0")}`;
    label = `Week ${w.week} · ${fmt(from)} – ${fmt(to)}`;
  } else if (type === "month" || type === "nextmonth") {
    const d = new Date(today + "T00:00:00");
    if (type === "nextmonth") d.setMonth(d.getMonth() + 1, 1);
    from = ymd(new Date(d.getFullYear(), d.getMonth(), 1));
    to = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    id = `WP-${from.slice(0, 7)}`;
    label = new Date(from + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  } else if (type === "year") {
    // annual plan: 12 months ahead starting this month
    const d = new Date(today + "T00:00:00");
    from = ymd(new Date(d.getFullYear(), d.getMonth(), 1));
    to = ymd(new Date(d.getFullYear(), d.getMonth() + 12, 0));
    id = `WP-ANNUAL-${from.slice(0, 7)}`;
    label = `Annual plan · ${fmt(from)} – ${fmt(to)}`;
  } else {
    from = cFrom || today; to = cTo || addDays(from, 6);
    id = `WP-${from.replace(/-/g, "")}-${to.replace(/-/g, "").slice(4)}`;
    label = `${fmt(from)} – ${fmt(to)}`;
  }
  return { type, from, to, id, label };
}

/* ---------------- data ---------------- */
async function loadWPData() {
  const get = p => db.ref(p).once("value").then(s => s.val() || {});
  const [panels, pits, earthR, luxR, assets, pmR, trs] = await Promise.all([
    get("panels"), get("earthPits"), get("earthingReports"), get("luxReports"), get("assets"), get("pmRecords"), get("transformers")]);
  const flat = obj => { const out = []; Object.entries(obj).forEach(([k, recs]) => Object.values(recs || {}).forEach(r => out.push({ _parent: k, ...r }))); return out; };
  return { panels, pits, earth: flat(earthR), lux: Object.values(luxR), assets, pm: flat(pmR), trs };
}

/* repeat a due date through the period: overdue items appear once as carry-over */
// align: optional function placing a projected date in its work window (e.g. toSunday, skipSunday)
function occurrences(nextDue, days, from, to, align) {
  const out = [];
  const fix = align || (x => x);
  const today = ymd(new Date());
  if (!nextDue) return [{ due: from, overdue: true, never: true }];
  let d = nextDue, guard = 0;
  if (d < today) {
    // overdue: carry it over once; the next cycle counts from when it is done (assume today)
    out.push({ due: d, overdue: true });
    d = fix(addDays(today, days));
  }
  // due before this period but not overdue → it belongs to the earlier plan; step to this period
  while (d < from && guard++ < 400) d = fix(addDays(d, days));
  while (d <= to && guard++ < 400) {
    out.push({ due: d, overdue: false });
    d = fix(addDays(d, days));
  }
  return out;
}

function luxAreas(lux) {
  const latest = {};
  lux.forEach(r => {
    const k = (r.samplingLocation || "").trim();
    if (!k) return;
    if (!latest[k] || (r.timestamp || "") > (latest[k].timestamp || "")) latest[k] = r;
  });
  return latest;
}

function buildTasks(data, mods, from, to, dept) {
  const disc = WP_DEPTS[dept || "E"].disc;
  const tasks = [];
  if (mods.includes("db")) Object.entries(data.panels).forEach(([id, p]) => {
    occurrences(p.nextInspectionDue ? ymd(new Date(p.nextInspectionDue)) : "", 30, from, to, skipSunday)
      .forEach(o => tasks.push({ mod: "db", ref: id, name: id, area: (p.location || "").trim(), detail: "Monthly DB inspection", ...o }));
  });
  if (mods.includes("earth")) Object.values(data.pits).forEach(p => {
    occurrences(p.nextDue, 30, from, to)
      .forEach(o => tasks.push({ mod: "earth", ref: p.id, name: `${p.id} ${p.name}`, area: "Earth pit", detail: "Earth resistance test (≤ 5 Ω)", ...o }));
  });
  if (mods.includes("lux")) Object.entries(luxAreas(data.lux)).forEach(([area, r]) => {
    occurrences(addDays(ymd(new Date(r.timestamp)), 30), 30, from, to)
      .forEach(o => tasks.push({ mod: "lux", ref: area, name: area, area: "LUX area", detail: "Lighting survey (3 points)", ...o }));
  });
  if (mods.includes("tr")) Object.entries(data.trs).forEach(([id, t]) => {
    occurrences(t.nextInspectionDue ? t.nextInspectionDue.slice(0, 10) : "", 60, from, to)
      .forEach(o => tasks.push({ mod: "tr", ref: id, name: id, area: (t.location || "").trim(), detail: "Transformer inspection", ...o }));
  });
  if (mods.includes("pm")) {
    const pm = [];
    Object.values(data.assets).forEach(a => {
      if (a.status === "Out of Service" || !CATEGORIES[a.category]) return;
      activeLevels(a).filter(l => l !== "D").forEach(L => {
        occurrences((a.pmStatus || {})[L]?.nextDue, levelDays(a, L), from, to, pmWindow(a) === "SUN" ? toSunday : skipSunday)
          .forEach(o => pm.push({ mod: "pm", ref: a.id, name: a.name, area: a.area, level: L, cls: critClass(a.crit), ...o }));
      });
    });
    // one work order per machine per date – highest level covers the lower ones
    const merged = {};
    pm.forEach(t => {
      const k = t.ref + "|" + t.due;
      if (!merged[k] || LEVEL_ORDER.indexOf(t.level) > LEVEL_ORDER.indexOf(merged[k].level)) merged[k] = t;
    });
    Object.values(merged).forEach(t => {
      const a = data.assets[t.ref];
      const items = discTasks(a.category, t.level, disc);
      if (!items.length) return;   // nothing for this discipline on this work order
      tasks.push({ ...t, items,
        detail: `${levelName(a, t.level)} PM · Class ${t.cls} – ${disc === "M" ? "mechanical" : "electrical"} checks (${items.length})` });
    });
  }
  return tasks.sort((a, b) => (b.overdue - a.overdue) || a.due.localeCompare(b.due) || WP_ORDER.indexOf(a.mod) - WP_ORDER.indexOf(b.mod));
}

/* ---------------- completion: was the task done in its window? ---------------- */
function taskDone(t, data, plan) {
  // window: from the plan start (or 15 days before due) until 15 days after due, never before the plan start
  const start = t.overdue ? plan.from : (addDays(t.due, -15) > plan.from ? addDays(t.due, -15) : plan.from);
  const end = addDays(t.due < plan.from ? plan.to : t.due, 15);
  const inWin = d => d && d >= start && d <= end;
  let date = "";
  if (t.mod === "db") { const p = data.panels[t.ref]; date = p && p.lastInspection ? ymd(new Date(p.lastInspection)) : ""; }
  if (t.mod === "tr") { const x = data.trs[t.ref]; date = x && x.lastInspection ? ymd(new Date(x.lastInspection)) : ""; }
  if (t.mod === "earth") date = data.earth.filter(r => r.pitId === t.ref && inWin(r.date)).map(r => r.date).sort()[0] || "";
  if (t.mod === "lux") date = data.lux.filter(r => (r.samplingLocation || "").trim() === t.ref && inWin(r.sampleDate)).map(r => r.sampleDate).sort()[0] || "";
  if (t.mod === "pm") date = data.pm.filter(r => r._parent === t.ref && inWin(r.date) &&
      LEVEL_ORDER.indexOf(r.level) >= LEVEL_ORDER.indexOf(t.level)).map(r => r.date).sort()[0] || "";
  return inWin(date) ? date : "";
}

// day heading row used to group a plan's tasks by the day they should be done
function dayKey(t) { return t.overdue ? "0-overdue" : t.due; }
function dayHeaderRow(t, count, cols) {
  if (t.overdue) return `<tr><td colspan="${cols}" style="background:#fde8e7;color:#b42318;font-weight:800;">
    ⚠ OVERDUE – do these first (${count})</td></tr>`;
  const d = new Date(t.due + "T00:00:00");
  const label = d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" });
  const sun = d.getDay() === 0;
  return `<tr><td colspan="${cols}" style="background:#1a1410;color:#fff;font-weight:700;">
    ${esc(label)}${sun ? " – Sunday shutdown window" : ""} · ${count} task(s)</td></tr>`;
}
function groupedRows(tasks, cols, rowFn) {
  let html = "", lastKey = null;
  tasks.forEach((t, i) => {
    const k = dayKey(t);
    if (k !== lastKey) { html += dayHeaderRow(t, tasks.filter(x => dayKey(x) === k).length, cols); lastKey = k; }
    html += rowFn(t, i);
  });
  return html;
}

// task cell: description plus the numbered checks for PM work orders
function taskCellHtml(t) {
  if (!t.items || !t.items.length) return esc(t.detail);
  return `<b>${esc(t.detail)}:</b><ol style="margin:4px 0 0;padding-left:18px;">` +
    t.items.map(i => i.startsWith("(Safety) ")
      ? `<li><i style="color:#b42318">(Safety)</i> ${esc(i.slice(9))}</li>` : `<li>${esc(i)}</li>`).join("") + "</ol>";
}

function planProgress(plan, data) {
  const tasks = plan.tasks || [];
  const today = ymd(new Date());
  let done = 0, overdue = 0;
  const status = tasks.map(t => {
    const d = taskDone(t, data, plan);
    if (d) done++; else if (t.due < today) overdue++;
    return d;
  });
  return { total: tasks.length, done, overdue, pending: tasks.length - done, pct: tasks.length ? Math.round(done / tasks.length * 100) : 0, status };
}
