/* =====================================================================
   WORK PLAN – what is due in a period across DB inspection, earthing,
   LUX, preventive maintenance (and transformers), and whether it was done.
   Shared by admin (Work Plan tab) and workplan_print.html.
   Needs pm-library.js loaded first.
   ===================================================================== */

const WP_MODULES = {
  db:    { name: "DB Inspection",           days: 30, resp: "Fazal Maqsood (Supervisor Electrical)" },
  earth: { name: "Earthing Inspection",     days: 30, resp: "Fazal Maqsood (Supervisor Electrical)" },
  lux:   { name: "LUX Monitoring",          days: 30, resp: "Mansab Ali (Asst. Supervisor Electrical)" },
  pm:    { name: "Preventive Maintenance",  days: 0,  resp: "Fazal Maqsood (Elec.) / Aziz Ur Rehman (Mech.)" },
  tr:    { name: "Transformer Inspection",  days: 60, resp: "Fazal Maqsood (Supervisor Electrical)" }
};
const WP_ORDER = ["pm", "db", "earth", "lux", "tr"];

/* Each department issues its own plan: HOD → supervisor / foreman */
const WP_DEPTS = {
  E: { name: "Electrical", suffix: "",
       hod: "Engr Touseef Ghalib – Deputy Manager Electrical (HOD)",
       to: "Fazal Maqsood – Supervisor Electrical",
       mods: ["pm", "db", "earth", "lux", "tr"], disc: "E",
       resp: { pm: "Fazal Maqsood (Supervisor Electrical) – electrical items" } },
  M: { name: "Mechanical", suffix: "-MECH",
       hod: "Engr Ahtasham Khurshid – Deputy Manager Mechanical (HOD)",
       to: "Aziz Ur Rehman – Mechanical Foreman",
       mods: ["pm"], disc: "M",
       resp: { pm: "Aziz Ur Rehman (Mechanical Foreman) – mechanical items" } }
};
function wpResp(dept, mod) { return (WP_DEPTS[dept || "E"].resp || {})[mod] || WP_MODULES[mod].resp; }
// number of PM checklist items for one discipline (E or M; safety items go with both)
function discTaskCount(category, level, disc) {
  return tasksFor(category, level).filter(t => t.d === disc || t.d === "S").length;
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
function occurrences(nextDue, days, from, to, sunday) {
  const out = [];
  if (!nextDue) return [{ due: from, overdue: true, never: true }];
  let d = nextDue;
  if (d < from) {
    out.push({ due: d, overdue: d < ymd(new Date()) });
    d = addDays(from, days);
    if (sunday) d = toSunday(d);
  }
  let guard = 0;
  while (d <= to && guard++ < 60) {
    if (d >= from) out.push({ due: d, overdue: d < ymd(new Date()) });
    d = addDays(d, days);
    if (sunday) d = toSunday(d);
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
    occurrences(p.nextInspectionDue ? p.nextInspectionDue.slice(0, 10) : "", 30, from, to)
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
        occurrences((a.pmStatus || {})[L]?.nextDue, PM_LEVELS[L].days, from, to, true)
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
      const n = discTaskCount(a.category, t.level, disc);
      if (!n) return;   // nothing for this discipline on this work order
      tasks.push({ ...t, detail: `${PM_LEVELS[t.level].name} PM · Class ${t.cls} · ${n} ${disc === "M" ? "mechanical" : "electrical"} items` });
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
