/* =====================================================================
   PREVENTIVE / PREDICTIVE MAINTENANCE LIBRARY
   Shared by machine.html, pm.html, tpm.html, earthing.html and admin.
   Strategy:  RCM decides WHAT to do for each failure mode,
              TPM gives operators the daily CLIT check (Clean, Lubricate,
              Inspect, Tighten) and red tags,
              CBM readings with limits catch failures before breakdown.
   Machine Shop #1 / #2 are excluded (maintained by another department).
   ===================================================================== */

const SITE_URL = "https://energycew-ui.github.io/panel-system/";

/* ---------------- frequency levels ---------------- */
// Doing a higher level also covers all lower levels (a Monthly PM includes the Weekly tasks).
const PM_LEVELS = {
  D: { name: "Daily (Operator TPM)", short: "Daily", days: 1 },
  W: { name: "Weekly", short: "Weekly", days: 7 },
  M: { name: "Monthly", short: "Monthly", days: 30 },
  Q: { name: "Quarterly", short: "Quarterly", days: 91 },
  H: { name: "Half-Yearly", short: "6-Monthly", days: 182 },
  Y: { name: "Yearly", short: "Yearly", days: 365 }
};
const LEVEL_ORDER = ["W", "M", "Q", "H", "Y"];   // maintenance levels (D is operator TPM)

const TEAM = [
  ["Engr Touseef", "Deputy Manager Electrical (HOD)"], ["Engr Ahtasham Khurshid", "Deputy Manager Mechanical (HOD)"],
  ["Fazal Maqsood", "Electrical Supervisor"],
  ["Mansab Ali", "Asst. Supervisor"], ["Suleman Akram", "Electrician"], ["Zubair Arshad", "Electrician"],
  ["Arslan", "Electrician"], ["M.Nawaz", "Electrician"], ["Zeeshan Ashraf", "Electrician"],
  ["M. Saddique", "Electrician"], ["Aziz Ur Rehman", "Mechanical Foreman"],
  ["Safdar Shahzad", "Asst. Supervisor Mechanical"], ["Sohail Ahmad", "Asst. Supervisor Mechanical"]
];

/* ---------------- condition-monitoring parameters ----------------
   good / alert: thresholds.  dir "up" = higher is worse, "down" = lower is worse.
   Vibration limits: ISO 10816-3 (group 2 machines, rigid base). */
const CBM_PARAMS = {
  vib:      { label: "Motor / bearing vibration", unit: "mm/s", good: 2.8, alert: 7.1, dir: "up", ref: "ISO 10816-3" },
  btemp:    { label: "Bearing / motor body temperature", unit: "°C", good: 70, alert: 85, dir: "up" },
  amps:     { label: "Motor current (% of nameplate FLA)", unit: "% FLA", good: 90, alert: 105, dir: "up" },
  ir:       { label: "Motor insulation resistance (500 V)", unit: "MΩ", good: 100, alert: 1, dir: "down", ref: "IEEE 43" },
  thermo:   { label: "Panel thermography – hottest point", unit: "°C", good: 60, alert: 80, dir: "up" },
  rope:     { label: "Wire rope diameter reduction", unit: "%", good: 5, alert: 10, dir: "up", ref: "ISO 4309" },
  brake:    { label: "Brake lining remaining", unit: "%", good: 50, alert: 25, dir: "down" },
  hydtemp:  { label: "Hydraulic oil temperature", unit: "°C", good: 55, alert: 65, dir: "up" },
  hydpress: { label: "Hydraulic system pressure (% of set)", unit: "%", good: 90, alert: 80, dir: "down" },
  disctemp: { label: "Compressor discharge temperature", unit: "°C", good: 95, alert: 105, dir: "up" },
  discpress:{ label: "Compressor discharge pressure", unit: "bar", good: 6.5, alert: 6.0, dir: "down" },
  hours:    { label: "Running hours since last service", unit: "h", good: 1800, alert: 2000, dir: "up" },
  batt:     { label: "Battery voltage (24 V system)", unit: "V", good: 25.0, alert: 24.0, dir: "down" },
  coolant:  { label: "Engine coolant temperature (on load)", unit: "°C", good: 90, alert: 98, dir: "up" },
  earthcont:{ label: "Earth continuity (body to earth bar)", unit: "Ω", good: 0.5, alert: 1.0, dir: "up" }
};

function cbmStatus(key, value) {
  const p = CBM_PARAMS[key];
  const v = parseFloat(value);
  if (!p || value === "" || value == null || isNaN(v)) return "";
  if (p.dir === "up") return v <= p.good ? "ok" : v <= p.alert ? "alert" : "danger";
  return v >= p.good ? "ok" : v >= p.alert ? "alert" : "danger";
}
function cbmLimitText(key) {
  const p = CBM_PARAMS[key];
  if (!p) return "";
  return p.dir === "up"
    ? `Good ≤ ${p.good} · Alert ≤ ${p.alert} · Danger > ${p.alert} ${p.unit}`
    : `Good ≥ ${p.good} · Alert ≥ ${p.alert} · Danger < ${p.alert} ${p.unit}`;
}

/* ---------------- machine categories: tasks, CBM, RCM ----------------
   task = [discipline, text]   discipline: E electrical, M mechanical, S safety */
const CATEGORIES = {
  OHC: {
    name: "Overhead Crane",
    levels: ["D", "W", "M", "Q", "Y"],
    cbm: { M: ["amps", "rope"], Q: ["thermo", "ir", "brake", "earthcont"] },
    tasks: {
      D: [["S", "Hoist, cross travel and long travel work smoothly from pendant"],
          ["S", "Upper / lower hoist limit switch stops the hook"],
          ["S", "Brake holds the load – no drift"],
          ["S", "Pendant emergency stop works"],
          ["S", "Hook safety latch present and working"],
          ["M", "Wire rope – no visible kinks or broken wires"],
          ["M", "No abnormal noise, smell or vibration"],
          ["S", "Crane path clear, no loose objects on girder"]],
      W: [["E", "Check pendant cable, push buttons and strain relief"],
          ["E", "Test all limit switches (hoist up/down, LT and CT end limits)"],
          ["E", "Check brake operation and air gap"],
          ["E", "Inspect DSL / festoon cable and current collectors"],
          ["M", "Lubricate wire rope, sheaves and hook block"],
          ["M", "Check hook, latch and swivel for wear or cracks"],
          ["S", "Check warning horn / beacon and SWL label"]],
      M: [["E", "Clean crane control panel (dry air / brush), check dust ingress"],
          ["E", "Tighten terminals of contactors, relays and overloads"],
          ["E", "Inspect contactor contacts for pitting – replace if worn"],
          ["E", "Measure hoist, LT and CT motor current"],
          ["M", "Check gearbox oil level and leakage"],
          ["M", "Check wheels, rail alignment and end stoppers"],
          ["M", "Measure wire rope diameter and count broken wires"]],
      Q: [["E", "Thermographic scan of crane panel and DSL"],
          ["E", "Insulation resistance test of hoist, LT and CT motors"],
          ["E", "Earth continuity of crane structure and panel"],
          ["M", "Inspect brake lining – adjust or replace"],
          ["M", "Check bolts of end carriages, girder and trolley"]],
      Y: [["E", "Replace worn pendant cable / push buttons"],
          ["E", "Overhaul brake coil / thruster, check motor bearings"],
          ["M", "Load test at rated SWL (competent person)"],
          ["M", "Gearbox oil change"],
          ["S", "Annual statutory crane inspection recorded"]]
    },
    rcm: [
      ["Limit switch fails", "Dust, wear, loose mounting", "Hook over-travel / crane stops (top fault 2025-26)", "Weekly function test, replace at first sign of sticking", "PM-W"],
      ["Contactor contacts pitted / burnt", "Frequent inching, loose terminals", "Crane stops, 13 faults / 537 min in 2026", "Monthly inspection + quarterly thermography", "PM-M + CBM"],
      ["Pendant cable / button damage", "Pulling, abrasion", "Loss of control, unsafe", "Weekly inspection, strain relief", "PM-W"],
      ["Brake lining worn", "Normal wear", "Load drift – SAFETY critical", "Quarterly lining % check", "CBM-Q"],
      ["Motor insulation breakdown", "Dust, heat, overload", "Motor burnout, long downtime", "Current monthly, IR quarterly", "CBM"],
      ["Wire rope wear / broken wires", "Fatigue, poor lubrication", "Rope failure – catastrophic", "Monthly diameter measurement (ISO 4309)", "CBM-M"]
    ]
  },
  MRC: {
    name: "Monorail Crane",
    levels: ["D", "W", "M", "Q", "Y"],
    cbm: { M: ["amps"], Q: ["thermo", "ir", "brake"] },
    tasks: {
      D: [["S", "Hoist up/down and travel work from pendant"],
          ["S", "Hoist limit switch stops the hook"],
          ["S", "Brake holds load, pendant emergency stop works"],
          ["M", "Chain / wire rope – no kinks, stretched links or broken wires"],
          ["S", "Hook latch present"],
          ["M", "No abnormal noise or vibration"]],
      W: [["E", "Check pendant cable and push buttons"],
          ["E", "Test hoist and travel limit switches"],
          ["E", "Check festoon cable / trolley supply"],
          ["M", "Lubricate chain / rope and trolley wheels"],
          ["M", "Check hook and latch for wear"]],
      M: [["E", "Clean and tighten hoist control panel terminals"],
          ["E", "Check contactors and overload relay"],
          ["E", "Measure hoist motor current"],
          ["M", "Check trolley wheels, beam end stops and fixing bolts"]],
      Q: [["E", "Thermography of hoist panel"],
          ["E", "IR test of hoist and travel motors"],
          ["M", "Check brake lining / adjust"]],
      Y: [["M", "Load test at rated SWL"],
          ["M", "Gearbox / chain replacement as per condition"],
          ["E", "Overhaul motor bearings and brake"]]
    },
    rcm: [
      ["Hoist limit switch / contactor fault", "Dust, wear", "Molding line stops (Monorail #3/#4 frequent)", "Weekly test, monthly panel PM", "PM"],
      ["Chain / rope wear", "Fatigue", "Load drop – safety", "Daily operator check + yearly load test", "TPM + PM"],
      ["Motor overload", "Mechanical binding", "Motor burnout", "Monthly current, quarterly IR", "CBM"]
    ]
  },
  MLD: {
    name: "Molding Machine",
    levels: ["D", "W", "M", "Q", "H", "Y"],
    cbm: { M: ["amps", "vib", "hydtemp", "hydpress"], Q: ["ir", "thermo"] },
    tasks: {
      D: [["M", "Hydraulic oil level visible in sight glass"],
          ["M", "No hydraulic leakage at hoses, cylinders or fittings"],
          ["M", "Clean sand / spillage from table, pattern area and machine"],
          ["M", "Jolt / squeeze working, pressure gauge reading normal"],
          ["S", "Emergency stop and guards in place"],
          ["E", "No abnormal noise or overheating of pump motor"]],
      W: [["E", "Check push buttons, selector switches and solenoid coils"],
          ["E", "Check limit / proximity switches and mounting"],
          ["M", "Inspect hydraulic hoses and fittings – tighten or replace weeping parts (RCA)"],
          ["M", "Check pattern plate mounting and clamping"],
          ["M", "Lubricate guide rods and moving parts"]],
      M: [["E", "Tighten machine panel terminals, check contactor and overload"],
          ["E", "Measure pump motor current and vibration"],
          ["M", "Check pattern / squeeze head alignment (RCA)"],
          ["M", "Record hydraulic oil temperature and pressure"],
          ["M", "Clean suction strainer and breather"]],
      Q: [["E", "IR test of hydraulic pump motor"],
          ["E", "Thermography of machine panel"],
          ["M", "Replace hydraulic return filter"],
          ["M", "Check accumulator pre-charge (if fitted)"]],
      H: [["M", "Hydraulic oil analysis / change as per condition"],
          ["M", "Replace worn seals of jolt / squeeze cylinders"]],
      Y: [["E", "Overhaul pump motor bearings"],
          ["M", "Complete machine overhaul and alignment"]]
    },
    rcm: [
      ["Hydraulic leakage / seal wear", "Worn seals, loose fittings, delayed PM", "Loss of pressure – top fault (889 min in RCA)", "Weekly leak check, 6-monthly seal change", "PM-W/H"],
      ["Solenoid coil burnt", "Over-voltage, heat, dust", "Machine not responding", "Weekly coil / connection check", "PM-W"],
      ["Pattern misalignment", "Vibration, loose clamps", "Mould defects, jamming", "Monthly alignment check", "PM-M"],
      ["Pump motor bearing failure", "Wear, contamination", "Machine stop", "Monthly vibration & current", "CBM-M"],
      ["Hydraulic oil overheating", "Dirty cooler / oil, high load", "Seal damage, low pressure", "Monthly oil temperature, 6-monthly analysis", "CBM"]
    ]
  },
  SND: {
    name: "Sand Plant System",
    levels: ["D", "W", "M", "Q", "Y"],
    cbm: { M: ["vib", "btemp", "amps"], Q: ["thermo", "ir"] },
    tasks: {
      D: [["M", "Clean sand / debris build-up on grid, chutes and conveyors (RCA)"],
          ["M", "Check belts for spillage, tracking and tears"],
          ["E", "Vibration motors running, no abnormal noise"],
          ["S", "Conveyor / elevator guards and pull-cords in place"],
          ["M", "Dust collector running, no leaks"]],
      W: [["E", "Check vibration motor cables, terminal box and bolts"],
          ["E", "Check MCC indicators, interlocks and emergency pull-cords"],
          ["M", "Tighten vibration motor mounting bolts"],
          ["M", "Check belt tension and scrapers"],
          ["M", "Grease bearings as per lubrication chart"]],
      M: [["E", "Measure vibration and bearing temperature of motors / gearboxes"],
          ["E", "Measure motor currents"],
          ["E", "Clean and tighten MCC panel terminals"],
          ["M", "Check gearbox oil level and leaks"],
          ["M", "Inspect liners, grid and screens for wear"],
          ["M", "Clean dust collector filter bags"]],
      Q: [["E", "Thermography of MCC panel"],
          ["E", "IR test of main motors"],
          ["M", "Check coupling alignment"],
          ["M", "Replace worn belts / scrapers"]],
      Y: [["E", "Overhaul vibration motor bearings"],
          ["M", "Gearbox oil change"],
          ["M", "Major overhaul during annual shutdown"]]
    },
    rcm: [
      ["Jamming from sand / debris build-up", "No cleaning SOP (RCA #3)", "Shakeout stops – 310 min in RCA", "Daily operator cleaning (TPM)", "TPM-D"],
      ["Vibration motor failure", "Bearing wear, loose mounting", "Shakeout stops", "Monthly vibration + temperature", "CBM-M"],
      ["Plant trip (breaker / MCC)", "Loose terminals, overheating", "Whole sand line stops (2026: 172 min)", "Monthly tightening, quarterly thermography", "PM + CBM"],
      ["Belt tear / mistracking", "Spillage, worn scrapers", "Conveyor stop", "Daily check, quarterly replacement", "TPM + PM"]
    ]
  },
  MUL: {
    name: "Sand Muller / Mixer",
    levels: ["D", "W", "M", "Q", "Y"],
    cbm: { M: ["amps", "vib", "btemp"], Q: ["ir"] },
    tasks: {
      D: [["M", "Clean muller pan / mixer, remove hardened sand"],
          ["M", "Ploughs / scrapers secure"],
          ["M", "No abnormal noise from gearbox"],
          ["S", "Guard and interlock in place"]],
      W: [["M", "Grease bearings"],
          ["M", "Check plough / wheel clearance"],
          ["E", "Check motor starter and push buttons"]],
      M: [["E", "Measure motor current and gearbox vibration"],
          ["E", "Tighten starter panel terminals"],
          ["M", "Check gearbox oil level and leakage"],
          ["M", "Check V-belts / coupling"]],
      Q: [["E", "IR test of motor"],
          ["M", "Replace worn ploughs / scrapers"]],
      Y: [["M", "Gearbox oil change"],
          ["E", "Motor bearing check / replacement"]]
    },
    rcm: [
      ["Gearbox failure", "Low oil, overload", "Core / CO₂ sand supply stops", "Monthly vibration + oil level", "CBM-M"],
      ["Plough / scraper wear", "Abrasive sand", "Poor mixing quality", "Quarterly replacement", "PM-Q"],
      ["Motor overload", "Hardened sand, jamming", "Motor trip / burnout (2026: 3 muller faults)", "Daily cleaning, monthly current", "TPM + CBM"]
    ]
  },
  CNV: {
    name: "Conveyor / Dryer / Fixture",
    levels: ["M", "Q", "Y"],
    cbm: { M: ["amps"], Q: ["ir"] },
    tasks: {
      M: [["E", "Check motor, starter and controls"],
          ["E", "Measure motor current"],
          ["M", "Lubricate bearings, chains and moving parts"],
          ["M", "Check belts / chains / sensors"]],
      Q: [["E", "IR test of motor"],
          ["M", "Inspect wear parts"]],
      Y: [["M", "General overhaul"]]
    },
    rcm: [
      ["Sensor / proximity fault", "Dust, misalignment", "Fixture or conveyor stops (T-case 48 min 2026)", "Monthly check", "PM-M"],
      ["Motor / drive failure", "Wear", "Section stops", "Monthly current, quarterly IR", "CBM"]
    ]
  },
  CMP: {
    name: "Air Compressor",
    levels: ["D", "W", "M", "Q", "H", "Y"],
    cbm: { D: ["disctemp", "discpress"], M: ["amps", "vib", "btemp", "hours"], Q: ["thermo", "ir"] },
    tasks: {
      D: [["M", "Record discharge pressure and temperature"],
          ["M", "Oil level visible in sight glass"],
          ["M", "Condensate drains working / receiver drained"],
          ["M", "No air leaks or abnormal noise"],
          ["E", "No alarm / warning on controller"]],
      W: [["M", "Blow out intake air filter"],
          ["M", "Clean cooler fins"],
          ["E", "Check panel / VSD cooling fans and filters"],
          ["E", "Check auto-drain valve operation"]],
      M: [["E", "Measure motor current, vibration and bearing temperature"],
          ["E", "Tighten power terminals, clean VSD heat sink"],
          ["M", "Check belt tension (if belt driven)"],
          ["M", "Air leak survey of main lines (energy objective)"],
          ["S", "Test safety valve with manual lever"]],
      Q: [["E", "Thermography of compressor panel and VSD"],
          ["E", "IR test of main motor"],
          ["M", "Replace air filter element"],
          ["M", "Replace oil filter / separator as per running hours"]],
      H: [["M", "Oil change as per hours / oil analysis"],
          ["M", "Check minimum pressure valve"]],
      Y: [["E", "Motor bearing greasing / replacement"],
          ["M", "Full service kit (2000 / 4000 h)"],
          ["S", "Pressure vessel statutory inspection"]]
    },
    rcm: [
      ["Over-temperature trip", "Dirty cooler / filter, low oil", "Plant air lost – all molding stops", "Weekly cleaning, daily discharge temperature", "TPM + CBM-D"],
      ["Bearing / airend failure", "Wear, poor oil", "Long downtime, high cost", "Monthly vibration & temperature, hours-based oil", "CBM-M"],
      ["Air leaks", "Worn fittings, hoses", "10% energy waste (objective 3)", "Monthly leak survey", "PM-M"],
      ["VSD drive fault", "Heat, dust in drive", "Compressor stops", "Monthly heat-sink cleaning, quarterly thermography", "PM + CBM"]
    ]
  },
  GEN: {
    name: "Diesel Generator",
    levels: ["W", "M", "Q", "H", "Y"],
    cbm: { W: ["batt"], Q: ["coolant", "ir", "hours"] },
    tasks: {
      W: [["E", "No-load test run 15 min – record voltage and frequency"],
          ["E", "Check battery voltage and terminals"],
          ["M", "Check fuel, oil and coolant levels"],
          ["M", "Check for oil / fuel / coolant leaks"]],
      M: [["E", "Check changeover / ATS operation"],
          ["E", "Tighten alternator and panel terminals"],
          ["M", "Clean air filter"],
          ["M", "Check fan belt tension"]],
      Q: [["E", "IR test of alternator"],
          ["E", "On-load test run – record parameters"],
          ["M", "Check radiator and hoses"]],
      H: [["M", "Change engine oil and filters (or per hours)"],
          ["M", "Replace fuel filters"]],
      Y: [["E", "Test protections and calibrate panel meters"],
          ["M", "Coolant change, injector check"]]
    },
    rcm: [
      ["Fails to start on demand", "Weak battery, fuel issue", "No backup power – hidden failure", "Weekly test run (failure-finding task)", "FF-W"],
      ["Overheating on load", "Radiator blockage, low coolant", "Shutdown during outage", "Quarterly load test + coolant temperature", "CBM-Q"],
      ["Alternator insulation failure", "Moisture, dust", "No output", "Quarterly IR", "CBM-Q"]
    ]
  },
  WSH: {
    name: "Workshop Machine",
    levels: ["M", "Q", "Y"],
    cbm: { Q: ["ir", "earthcont"] },
    tasks: {
      M: [["E", "Check motor, switch and earth connection"],
          ["E", "Check cables and plugs for damage"],
          ["M", "Lubricate slides / gears"],
          ["S", "Guards and emergency stop in place"]],
      Q: [["E", "IR test of motor and earth continuity"],
          ["M", "Check belts / gears for wear"]],
      Y: [["M", "Overhaul / alignment"]]
    },
    rcm: [
      ["Electrical shock hazard", "Damaged cable, lost earth", "Injury", "Monthly cable check, quarterly earth continuity", "PM + CBM"],
      ["Motor / gear wear", "Normal use", "Workshop delay (low impact)", "Time-based light PM", "PM"]
    ]
  },
  WTL: {
    name: "Portable / Small Tool",
    levels: ["M"],
    cbm: {},
    tasks: {
      M: [["S", "Cable, plug, guard and earth connection safe"],
          ["S", "Switch and emergency stop working"]]
    },
    rcm: [
      ["Tool failure", "Normal wear", "Low impact – spare available", "Run-to-failure; monthly safety check only", "RTF"]
    ]
  }
};

/* ---------------- RCM criticality ----------------
   Each 1-5:  S = Safety/Environment, P = Production impact,
              C = Repair cost / MTTR,  F = Failure frequency (from fault history)
   Total 4-20:  A ≥ 14 (critical)  ·  B 9-13  ·  C ≤ 8 */
function critClass(c) {
  const t = c.S + c.P + c.C + c.F;
  return t >= 14 ? "A" : t >= 9 ? "B" : "C";
}
const CRIT_TEXT = {
  A: "Critical – breakdown stops production or is a safety risk",
  B: "Important – partial production impact",
  C: "Low – little impact, spares available"
};

// RCM decision: which maintenance strategy each asset gets
function strategyFor(asset) {
  if (asset.status === "Out of Service") return { code: "OOS", name: "Not in service – no PM" };
  if (asset.category === "WTL") return { code: "RTF", name: "Run-to-Failure (safety check only)" };
  const cls = critClass(asset.crit);
  const hasCbm = Object.keys(CATEGORIES[asset.category].cbm).length > 0;
  if (cls === "A" && hasCbm) return { code: "CBM+PM", name: "Condition-Based + Preventive (predictive)" };
  if (cls === "B" && hasCbm) return { code: "PM+CBM", name: "Preventive + condition checks" };
  return { code: "PM", name: "Time-based Preventive" };
}

/* Frequency follows criticality (RCM): weekly PM only where the risk justifies it.
   Class A and all cranes (lifting safety, RCA #2) → full plan incl. Weekly.
   Class B → starts at Monthly (weekly tasks are folded into the monthly checklist).
   Class C → Monthly / Quarterly / Yearly only. */
function activeLevels(asset) {
  const lv = CATEGORIES[asset.category].levels;
  if (asset.status === "Out of Service") return [];
  const cls = critClass(asset.crit);
  const crane = ["OHC", "MRC"].includes(asset.category);
  return lv.filter(l => {
    if (l === "W") return cls === "A" || crane || asset.category === "GEN";   // generator weekly test = failure-finding
    if (l === "H") return cls !== "C";
    return true;
  });
}

/* ---------------- scheduling helpers ---------------- */
function ymd(d) { const x = new Date(d); return new Date(x - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function addDays(dateStr, n) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); }
function daysUntil(dateStr) {
  const t = new Date(ymd(new Date()) + "T00:00:00");
  return Math.round((new Date(dateStr + "T00:00:00") - t) / 86400000);
}
// Move a date to the next Sunday (weekly shutdown window for PM)
function toSunday(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return ymd(d);
}
function dueBadge(dateStr) {
  if (!dateStr) return { cls: "badge-bad", text: "Not scheduled" };
  const n = daysUntil(dateStr);
  if (n < 0) return { cls: "badge-bad", text: `Overdue ${-n}d` };
  if (n === 0) return { cls: "badge-warn", text: "Due today" };
  if (n <= 7) return { cls: "badge-warn", text: `Due in ${n}d` };
  return { cls: "badge-ok", text: `In ${n}d` };
}

// scheduled levels reset when a given level is performed (higher includes lower)
function levelsToReschedule(asset, level) {
  const idx = LEVEL_ORDER.indexOf(level);
  return activeLevels(asset).filter(l => l !== "D" && LEVEL_ORDER.indexOf(l) <= idx);
}
// task levels covered when a given level is performed (higher includes lower)
function levelsCovered(category, level) {
  const plan = CATEGORIES[category].levels.filter(l => l !== "D");
  const idx = LEVEL_ORDER.indexOf(level);
  return plan.filter(l => LEVEL_ORDER.indexOf(l) <= idx);
}
// tasks for a level including all lower levels
function tasksFor(category, level) {
  const cat = CATEGORIES[category];
  if (level === "D") return (cat.tasks.D || []).map(t => ({ lvl: "D", d: t[0], text: t[1] }));
  const out = [];
  levelsCovered(category, level).forEach(l =>
    (cat.tasks[l] || []).forEach(t => out.push({ lvl: l, d: t[0], text: t[1] })));
  return out;
}
function cbmFor(category, level) {
  const cat = CATEGORIES[category];
  const keys = new Set();
  const lv = level === "D" ? ["D"] : ["D", ...levelsCovered(category, level)];
  lv.forEach(l => (cat.cbm[l] || []).forEach(k => keys.add(k)));
  return [...keys];
}

/* ---------------- earth pits ---------------- */
const EARTH_LIMIT = 5.0;   // Ω – site acceptance criterion (IEC 60364-6, IEEE 81)
const EARTH_CHECKS = [
  ["chamber", "Earth pit chamber / cover in good condition and accessible"],
  ["tag", "Earth pit identification tag / number visible"],
  ["clamps", "Earth conductor and clamp connections tight, no looseness"],
  ["corrosion", "No corrosion, burning or damage on electrode / strip / cable"],
  ["watered", "Pit watered / soil moisture maintained (where applicable)"],
  ["bonding", "Equipment body and panel earth bonding continuity checked"]
];
/* Test & measuring equipment – IMS "Master List of Electrical Equipment" (Electrical Maintenance) */
const EQUIPMENT = [
  { code: "EQ-ELM-DM-001",  name: "Digital Multimeter",           make: "SANWA CD800a",            serial: "08105009214", use: ["volt", "earthcont"] },
  { code: "EQ-ELM-DCM-002", name: "Digital Clamp Meter",          make: "UNI-T UT 203",            serial: "N/A",         use: ["amps"] },
  { code: "EQ-ELM-DCM-003", name: "Digital Clamp Meter",          make: "KYORITSU KEW 2117R",      serial: "1712963",     use: ["amps"] },
  { code: "EQ-ELM-DCM-004", name: "Digital Clamp Meter",          make: "INGCO DCM100014",         serial: "N/A",         use: ["amps"] },
  { code: "EQ-ELM-IRT-005", name: "Insulation Resistance Tester", make: "KYORITSU 3005A",          serial: "E8476258",    use: ["ir"] },
  { code: "EQ-ELM-ERT-006", name: "Earth Resistance Tester",      make: "KYORITSU KEW 4105A",      serial: "E8443183",    use: ["earth"],
    calCert: "25/12/LHE/0192187", calDue: "2027-08-11" },
  { code: "EQ-ELM-DT-001",  name: "Digital Tachometer",           make: "DT-2235B+ (contact/surface)", serial: "S5138637", use: ["rpm"] },
  { code: "EQ-ELM-DLM-001", name: "Digital Lux Meter",            make: "MASTECH MS6612",          serial: "MBHF002987",  use: ["lux"] }
];
function equipLabel(e) { return `${e.code} – ${e.name}, ${e.make}${e.serial && e.serial !== "N/A" ? " (S/N " + e.serial + ")" : ""}`; }
const EARTH_INSTRUMENT = { code: "EQ-ELM-ERT-006", make: "KYORITSU KEW 4105A", serial: "E8443183" };

/* ---------------- small UI helpers ---------------- */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function critBadge(asset) {
  const c = critClass(asset.crit);
  const cls = c === "A" ? "badge-bad" : c === "B" ? "badge-warn" : "badge-info";
  return `<span class="badge ${cls}">Class ${c}</span>`;
}
function statusBadgeCbm(st) {
  return st === "ok" ? '<span class="badge badge-ok">GOOD</span>'
       : st === "alert" ? '<span class="badge badge-warn">ALERT</span>'
       : st === "danger" ? '<span class="badge badge-bad">DANGER</span>' : "";
}
