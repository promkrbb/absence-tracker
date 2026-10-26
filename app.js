/* ============================================================
   Absence Budget 🎓 — track the school's 20%-per-subject rule.
   Backend: Supabase (schema: attendance). Auth: anonymous sign-in.
   Data: catalog.json (M.6 timetable extracted from the school xlsx).
   Bilingual: English / ไทย.
   ============================================================ */

const SUPABASE_URL = "https://upbgsloshvzthfanmtws.supabase.co";
const SUPABASE_KEY = "sb_publishable_NTuGVL4ve9JEn5opacSrfg_ZzsmkCu7";
const ABSENT_LIMIT = 0.20; // 20% of total periods

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: "attendance" },
  auth: { persistSession: true, autoRefreshToken: true },
});

// ---------- global state ----------
let UID = null;
let CAT = null;                 // catalog.json
let SECTION = localStorage.getItem("atd_section") || "ม.6/2ย";
let SUBJECTS = [];              // rows from attendance.subjects (current section)
let ABSENCES = [];             // rows from attendance.absences (future-dated = planned)
let PROFILE = null;            // my attendance.profiles row (display name + share code)
let BUDDIES = [];              // [{ profile, subjects, absences }] for linked friends
let LANG = localStorage.getItem("atd_lang") ||
  ((navigator.language || "en").toLowerCase().startsWith("th") ? "th" : "en");

// ============================================================
//  i18n
// ============================================================
const T = {
  en: {
    appName: "Absence Budget",
    tabToday: "Today", tabOverview: "Overview", tabSubjects: "Subjects", tabFriends: "Friends", tabSettings: "Settings",
    todaysClasses: "Today's classes",
    noClassReason: "No class today: {r}", termNotStarted: "The term hasn't started yet.",
    termOver: "Regular classes are over for this term 🎉",
    classesLeft: "{n} real classes left this term", plannedN: "{n} planned", plannedTag: "Planned",
    plannedNote: "Pick a future date to plan an absence. It counts against your budget now and becomes a real absence when the day comes.",
    creditsN: "{c} credit",
    friendsTitle: "Friends", friendsNote: "Share your code with a friend. Once one of you adds the other's code, you can both see how close each other is to the limit.",
    myCode: "My code", addFriend: "Add a friend's code", friendCodePh: "e.g. 7KQ2XD", link: "Add",
    linked: "Friend added ✓", codeNotFound: "No one has that code", noFriends: "No friends added yet.",
    removeFriend: "Remove", removeFriendQ: "Remove {n} from friends? You'll both stop seeing each other.",
    allGood: "Every subject is fine", closest: "Closest to the limit",
    todayNote: "Tap “Absent” on a class you missed today — it logs those periods against your 20% budget.",
    noClassToday: "No classes today. Enjoy!",
    pickSectionTitle: "Pick your class", pickSection: "Pick my section",
    pickSectionSub: "Choose your M.6 section and all your subjects and 20% limits load automatically.",
    overviewNote: "How many periods you can still miss in each subject before crossing the 20% line. Tap a subject for details.",
    noSubjects: "No subjects yet — pick your section in Settings.",
    mySubjects: "My subjects", addSubject: "+ Subject",
    subjectsNote: "These loaded from your section. Tap one to fix its total periods or budget if the school counts differently.",
    settings: "Settings", mySection: "My section", pickChangeSection: "Pick / change section",
    semester: "Semester", thisWeek: "This week",
    thisWeekHint: "Auto-set from the calendar. Fix it here if a holiday shifts the A/B rotation.",
    weekA: "Week A", weekB: "Week B", language: "Language",
    yourName: "Your name", saveName: "Save name", namePh: "e.g. Prom",
    installTitle: "📲 Install on your phone",
    installBody: "<strong>Android (Chrome):</strong> menu ⋮ → “Add to Home screen”.<br /><strong>iPhone (Safari):</strong> Share ⬆️ → “Add to Home Screen”.",
    backupTitle: "💾 Backup", backupDesc: "Save a code with all your data. Paste it back after a phone wipe or on another device.",
    exportBackup: "Copy my backup code", importBackup: "Paste a code to restore",
    footer: "Absence Budget • data synced via Supabase",
    weekOf: "Week {n} / {t}", left: "left", used: "used", periods: "periods",
    ofBudget: "{used} of {budget} used · {total} periods total",
    absent: "Absent", undo: "Undo ↩︎", markedToday: "Marked absent today ✓",
    overBudget: "⚠️ Over the 20% limit",
    subjectDetail: "Subject", noAbsences: "No absences logged yet.",
    addAbsence: "Log an absence", date: "Date", howManyPeriods: "How many periods?",
    noteOptional: "Note (optional)", notePh: "e.g. sick, dentist", save: "Save",
    logged: "Logged ✓", deleted: "Deleted", deleteAbsenceQ: "Delete this absence?",
    editSubject: "Edit subject", subjectName: "Subject name", totalPeriods: "Total periods (semester)",
    budgetPeriods: "Absence budget (periods)", color: "Color", saveChanges: "Save changes",
    deleteSubject: "Delete subject", deleteSubjectQ: "Delete this subject and its absences?",
    addCustomSubject: "Add subject", saved: "Saved", saveFailed: "Save failed",
    pickYourSection: "Pick your section",
    pickSectionNote: "Your subjects and each subject's 20% limit come straight from the school timetable.",
    switchSectionQ: "Switch to {s}? Your logged absences stay saved per subject.",
    signInFirst: "Turn on sign-in first", couldntSave: "Couldn't save — check connection",
    authBanner: "⚠️ <strong>Saving is off.</strong> Turn on <strong>Anonymous sign-ins</strong> in Supabase (Authentication → Providers), then refresh.",
    copied: "Copied ✓", copyManually: "Select & copy manually", noData: "Nothing to back up yet",
    pasteCodePrompt: "Paste your backup code:", restoreConfirm: "Restore this backup? It replaces your current data.",
    restored: "Restored ✓", codeDidntWork: "That code didn't work",
    periodShort: "P", roomShort: "Room",
    days: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    daysShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  },
  th: {
    appName: "โควตาการขาด",
    tabToday: "วันนี้", tabOverview: "ภาพรวม", tabSubjects: "รายวิชา", tabFriends: "เพื่อน", tabSettings: "ตั้งค่า",
    todaysClasses: "คาบเรียนวันนี้",
    noClassReason: "วันนี้ไม่มีเรียน: {r}", termNotStarted: "ยังไม่เปิดภาคเรียน",
    termOver: "หมดคาบเรียนปกติของเทอมนี้แล้ว 🎉",
    classesLeft: "เหลือเรียนจริงอีก {n} คาบในเทอมนี้", plannedN: "วางแผนขาด {n}", plannedTag: "วางแผน",
    plannedNote: "เลือกวันในอนาคตเพื่อวางแผนการขาด ระบบจะหักโควตาไว้ก่อน และนับเป็นการขาดจริงเมื่อถึงวันนั้น",
    creditsN: "{c} หน่วยกิต",
    friendsTitle: "เพื่อน", friendsNote: "แชร์โค้ดให้เพื่อน เมื่อคนใดคนหนึ่งใส่โค้ดของอีกฝ่าย ทั้งสองคนจะเห็นว่าอีกฝ่ายใกล้เกินโควตาแค่ไหน",
    myCode: "โค้ดของฉัน", addFriend: "ใส่โค้ดของเพื่อน", friendCodePh: "เช่น 7KQ2XD", link: "เพิ่ม",
    linked: "เพิ่มเพื่อนแล้ว ✓", codeNotFound: "ไม่พบโค้ดนี้", noFriends: "ยังไม่ได้เพิ่มเพื่อน",
    removeFriend: "ลบ", removeFriendQ: "ลบ {n} ออกจากเพื่อน? ทั้งสองคนจะไม่เห็นข้อมูลของกันและกันอีก",
    allGood: "ทุกวิชายังปลอดภัย", closest: "ใกล้เกินโควตาที่สุด",
    todayNote: "แตะ “ขาด” ที่วิชาที่คุณขาดวันนี้ ระบบจะบันทึกคาบนั้นเข้าโควตา 20% ให้",
    noClassToday: "วันนี้ไม่มีเรียน พักผ่อนได้เลย!",
    pickSectionTitle: "เลือกห้องของคุณ", pickSection: "เลือกห้องของฉัน",
    pickSectionSub: "เลือกห้อง ม.6 ของคุณ แล้ววิชาทั้งหมดพร้อมโควตา 20% จะโหลดให้อัตโนมัติ",
    overviewNote: "คุณยังขาดได้อีกกี่คาบในแต่ละวิชาก่อนจะเกินเส้น 20% แตะที่วิชาเพื่อดูรายละเอียด",
    noSubjects: "ยังไม่มีวิชา — เลือกห้องของคุณในหน้าตั้งค่า",
    mySubjects: "รายวิชาของฉัน", addSubject: "+ วิชา",
    subjectsNote: "โหลดจากห้องของคุณแล้ว แตะเพื่อแก้จำนวนคาบรวมหรือโควตา หากโรงเรียนนับต่างออกไป",
    settings: "ตั้งค่า", mySection: "ห้องของฉัน", pickChangeSection: "เลือก / เปลี่ยนห้อง",
    semester: "ภาคเรียน", thisWeek: "สัปดาห์นี้",
    thisWeekHint: "ตั้งอัตโนมัติจากปฏิทิน ถ้าวันหยุดทำให้สลับ A/B คลาดเคลื่อน แก้ตรงนี้ได้",
    weekA: "สัปดาห์ A", weekB: "สัปดาห์ B", language: "ภาษา",
    yourName: "ชื่อของคุณ", saveName: "บันทึกชื่อ", namePh: "เช่น พรหม",
    installTitle: "📲 ติดตั้งบนโทรศัพท์",
    installBody: "<strong>Android (Chrome):</strong> เมนู ⋮ → “เพิ่มไปที่หน้าจอหลัก”<br /><strong>iPhone (Safari):</strong> แชร์ ⬆️ → “เพิ่มลงในหน้าจอโฮม”",
    backupTitle: "💾 สำรองข้อมูล", backupDesc: "บันทึกโค้ดที่มีข้อมูลทั้งหมด วางกลับหลังล้างเครื่องหรือบนอุปกรณ์อื่น",
    exportBackup: "คัดลอกโค้ดสำรอง", importBackup: "วางโค้ดเพื่อกู้คืน",
    footer: "โควตาการขาด • ซิงค์ผ่าน Supabase",
    weekOf: "สัปดาห์ที่ {n} / {t}", left: "เหลือ", used: "ใช้ไป", periods: "คาบ",
    ofBudget: "ขาดไป {used} จาก {budget} คาบ · ทั้งหมด {total} คาบ",
    absent: "ขาด", undo: "เลิกทำ ↩︎", markedToday: "บันทึกการขาดวันนี้แล้ว ✓",
    overBudget: "⚠️ เกินเส้น 20% แล้ว",
    subjectDetail: "รายวิชา", noAbsences: "ยังไม่มีการบันทึกการขาด",
    addAbsence: "บันทึกการขาด", date: "วันที่", howManyPeriods: "กี่คาบ?",
    noteOptional: "หมายเหตุ (ไม่บังคับ)", notePh: "เช่น ป่วย, หาหมอฟัน", save: "บันทึก",
    logged: "บันทึกแล้ว ✓", deleted: "ลบแล้ว", deleteAbsenceQ: "ลบการขาดนี้?",
    editSubject: "แก้ไขวิชา", subjectName: "ชื่อวิชา", totalPeriods: "จำนวนคาบรวม (ภาคเรียน)",
    budgetPeriods: "โควตาการขาด (คาบ)", color: "สี", saveChanges: "บันทึกการแก้ไข",
    deleteSubject: "ลบวิชา", deleteSubjectQ: "ลบวิชานี้พร้อมประวัติการขาด?",
    addCustomSubject: "เพิ่มวิชา", saved: "บันทึกแล้ว", saveFailed: "บันทึกไม่สำเร็จ",
    pickYourSection: "เลือกห้องของคุณ",
    pickSectionNote: "วิชาและโควตา 20% ของแต่ละวิชา มาจากตารางเรียนของโรงเรียนโดยตรง",
    switchSectionQ: "เปลี่ยนเป็น {s}? ประวัติการขาดของคุณยังถูกเก็บไว้แยกตามวิชา",
    signInFirst: "เปิดการเข้าสู่ระบบก่อน", couldntSave: "บันทึกไม่ได้ — ตรวจสอบการเชื่อมต่อ",
    authBanner: "⚠️ <strong>การบันทึกปิดอยู่</strong> เปิด <strong>Anonymous sign-ins</strong> ใน Supabase (Authentication → Providers) แล้วรีเฟรช",
    copied: "คัดลอกแล้ว ✓", copyManually: "เลือกและคัดลอกเอง", noData: "ยังไม่มีข้อมูลให้สำรอง",
    pasteCodePrompt: "วางโค้ดสำรองของคุณ:", restoreConfirm: "กู้คืนข้อมูลนี้? จะแทนที่ข้อมูลปัจจุบัน",
    restored: "กู้คืนแล้ว ✓", codeDidntWork: "โค้ดนี้ใช้ไม่ได้",
    periodShort: "คาบ", roomShort: "ห้อง",
    days: ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"],
    daysShort: ["อา","จ","อ","พ","พฤ","ศ","ส"],
    months: ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."],
  },
};
function t(key, vars) {
  let s = (T[LANG] && T[LANG][key] != null) ? T[LANG][key] : (T.en[key] != null ? T.en[key] : key);
  if (vars) for (const k in vars) s = String(s).split("{" + k + "}").join(vars[k]);
  return s;
}

// ---------- tiny helpers ----------
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg) {
  const el = $("toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove("show"), 1800);
}
function fmtDate(d) {
  return `${T[LANG].daysShort[d.getDay()]} ${d.getDate()} ${T[LANG].months[d.getMonth()]}`;
}

// ============================================================
//  Week A/B + week number
// ============================================================
function mondayOf(d) { return addDays(d, -(((d.getDay() + 6) % 7))); }
const otherWeek = (w) => (w === "A" ? "B" : "A");
function weekOverride() {
  try { const s = JSON.parse(localStorage.getItem("atd_week") || "null"); if (s && s.monday && s.letter) return s; } catch {}
  return null;
}
function anchor() { return (CAT && CAT.weekAnchor) || { week: 17, letter: "A", monday: "2026-08-31" }; }
function weekInfoFor(date) {
  const a = anchor();
  const aMon = mondayOf(new Date(a.monday + "T00:00:00"));
  const diff = Math.round((mondayOf(date) - aMon) / (7 * 86400000));
  let letter = (((diff % 2) + 2) % 2 === 0) ? a.letter : otherWeek(a.letter);
  const number = a.week + diff;
  const ov = weekOverride();
  if (ov && ov.monday === iso(mondayOf(date))) letter = ov.letter;
  return { letter, number };
}
// Is there school on this date? → { open:true } or { open:false, reason }
function dayInfo(date) {
  const wd = date.getDay();
  if (wd < 1 || wd > 5) return { open: false, reason: "weekend" };
  const cal = CAT && CAT.calendar;
  if (!cal) return { open: true };
  const d = iso(date);
  if (d < cal.start) return { open: false, reason: "before" };
  if (d > cal.lastClass) return { open: false, reason: "over" };
  const off = (cal.noClass || []).find((x) => x.date === d);
  if (off) return { open: false, reason: "holiday", label: off[LANG] || off.en };
  return { open: true };
}
function catSubject(s) {
  const subs = (CAT && CAT.sections[SECTION] && CAT.sections[SECTION].subjects) || [];
  return subs.find((c) => (s.code && c.code === s.code) || c.name === s.name);
}
// periods this subject meets on a given date (0 if no school or not timetabled)
function periodsOn(cs, date) {
  if (!cs || !dayInfo(date).open) return 0;
  const { letter } = weekInfoFor(date);
  return (cs.slots || []).filter((sl) => sl.week === letter && sl.day === date.getDay()).length;
}
// real class periods still ahead this term (today included), from timetable + calendar
function remainingSessions(s) {
  const cs = catSubject(s);
  if (!cs || !CAT.calendar) return null;
  const end = new Date(CAT.calendar.lastClass + "T00:00:00");
  let n = 0;
  for (let d = today(); d <= end; d = addDays(d, 1)) n += periodsOn(cs, d);
  return n;
}

function setThisWeek(letter) {
  localStorage.setItem("atd_week", JSON.stringify({ monday: iso(mondayOf(today())), letter }));
  renderAll(); toast(t("saved"));
}

// ============================================================
//  STARTUP
// ============================================================
init();
async function init() {
  document.documentElement.lang = LANG;
  wireTabs(); wireSettings();
  $("backdrop").onclick = closeSheet;
  applyStaticI18n();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});

  try { CAT = await (await fetch("catalog.json")).json(); } catch { CAT = null; }

  let authOk = false;
  const { data: sess } = await sb.auth.getSession();
  if (sess?.session) { UID = sess.session.user.id; authOk = true; }
  else {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) { $("whoami").textContent = "⚠️"; showAuthBanner(); console.error("Anon sign-in failed:", error.message); }
    else { UID = data.user.id; authOk = true; }
  }
  if (authOk) {
    $("whoami").textContent = localStorage.getItem("atd_name") || "Guest";
    await ensureSeeded(); await loadAll();
    await ensureProfile(); await loadBuddies();
  }
  renderAll();
}

function showAuthBanner() {
  let b = $("authBanner");
  if (!b) {
    b = document.createElement("div");
    b.id = "authBanner"; b.className = "note";
    b.style.cssText = "margin:0 0 12px;background:#fde8e8;color:#a11;";
    $("screen-today").insertBefore(b, $("screen-today").firstChild);
  }
  b.innerHTML = t("authBanner");
}

// Seed subjects for the current section if none exist yet for this user.
async function ensureSeeded() {
  if (!UID || !CAT) return;
  const { data: existing } = await sb.from("subjects").select("id").eq("user_id", UID).eq("section", SECTION).eq("semester", CAT.semester).limit(1);
  if (existing && existing.length) return;
  const sec = CAT.sections[SECTION];
  if (!sec) return;
  const rows = sec.subjects.map((s, i) => ({
    user_id: UID, section: SECTION, semester: CAT.semester, code: s.code, name: s.name,
    sem_total: s.semTotal, budget: s.budget, color: s.color, sort: i,
  }));
  if (rows.length) await sb.from("subjects").insert(rows);
}

async function loadAll() {
  const [{ data: subs }, { data: abs }] = await Promise.all([
    sb.from("subjects").select("*").eq("user_id", UID).eq("section", SECTION).eq("semester", CAT ? CAT.semester : "").order("sort"),
    sb.from("absences").select("*").eq("user_id", UID),
  ]);
  SUBJECTS = subs || [];
  const ids = new Set(SUBJECTS.map((s) => s.id));
  ABSENCES = (abs || []).filter((a) => ids.has(a.subject_id));
}

// ---------- profile + friends ----------
async function ensureProfile() {
  const { data } = await sb.from("profiles").select("*").eq("user_id", UID).maybeSingle();
  PROFILE = data;
  const name = localStorage.getItem("atd_name") || "Guest";
  if (!PROFILE) {
    const { data: made } = await sb.from("profiles").insert({ user_id: UID, display_name: name, section: SECTION }).select().single();
    PROFILE = made;
  } else if (PROFILE.section !== SECTION || PROFILE.display_name !== name) {
    await saveProfile();
  }
}
async function saveProfile() {
  if (!PROFILE) return;
  const display_name = localStorage.getItem("atd_name") || "Guest";
  const { data } = await sb.from("profiles").update({ display_name, section: SECTION }).eq("user_id", UID).select().single();
  if (data) PROFILE = data;
}
async function loadBuddies() {
  BUDDIES = [];
  if (!CAT) return;
  const { data: links } = await sb.from("buddies").select("owner_id").eq("viewer_id", UID);
  const ids = (links || []).map((l) => l.owner_id);
  if (!ids.length) return;
  const [{ data: profs }, { data: subs }, { data: abs }] = await Promise.all([
    sb.from("profiles").select("*").in("user_id", ids),
    sb.from("subjects").select("*").in("user_id", ids).eq("semester", CAT.semester),
    sb.from("absences").select("*").in("user_id", ids),
  ]);
  BUDDIES = (profs || []).map((p) => {
    const subjects = (subs || []).filter((s) => s.user_id === p.user_id && s.section === p.section);
    const sids = new Set(subjects.map((s) => s.id));
    return { profile: p, subjects, absences: (abs || []).filter((a) => sids.has(a.subject_id)) };
  });
}
async function linkBuddy(code) {
  const { data, error } = await sb.rpc("link_buddy", { code: code.trim().toUpperCase() });
  if (error || !data) { toast(t("codeNotFound")); return; }
  await loadBuddies(); renderBuddies(); toast(t("linked"));
}
async function unlinkBuddy(b) {
  if (!confirm(t("removeFriendQ", { n: b.profile.display_name }))) return;
  await sb.rpc("unlink_buddy", { other: b.profile.user_id });
  await loadBuddies(); renderBuddies(); toast(t("deleted"));
}

// ============================================================
//  Computations
// ============================================================
// used = absences up to today; planned = future-dated ones (they become "used" when the day comes)
function usedFor(subjId, list = ABSENCES) {
  const d = iso(today());
  return list.filter((a) => a.subject_id === subjId && a.the_date <= d).reduce((n, a) => n + (a.periods || 0), 0);
}
function plannedFor(subjId, list = ABSENCES) {
  const d = iso(today());
  return list.filter((a) => a.subject_id === subjId && a.the_date > d).reduce((n, a) => n + (a.periods || 0), 0);
}
function budgetLine(s, used, planned) {
  let txt = t("ofBudget", { used, budget: s.budget, total: s.sem_total });
  if (planned) txt += " · " + t("plannedN", { n: planned });
  return txt;
}
function meterHtml(s, used, planned) {
  const w = (n) => s.budget ? Math.min(100, Math.round((n / s.budget) * 100)) : 0;
  const u = w(used), p = Math.min(100 - u, w(planned));
  return `<div class="meter"><i style="width:${u}%"></i><i class="plan" style="width:${p}%"></i></div>`;
}
function statusOf(used, budget) {
  const left = budget - used;
  if (left <= 0) return { cls: "danger", left };
  if (left <= Math.max(1, Math.round(budget * 0.25))) return { cls: "warn", left };
  return { cls: "ok", left };
}
function slotsToday() {
  if (!CAT || !CAT.sections[SECTION]) return [];
  const wd = new Date().getDay();            // 0..6
  if (!dayInfo(today()).open) return [];     // weekend, holiday, exams, outside term
  const { letter } = weekInfoFor(today());
  const out = [];
  CAT.sections[SECTION].subjects.forEach((cs) => {
    const periods = (cs.slots || []).filter((sl) => sl.week === letter && sl.day === wd).map((sl) => sl.period).sort((a, b) => a - b);
    if (periods.length) out.push({ name: cs.name, code: cs.code, color: cs.color, periods });
  });
  // sort by earliest period
  out.sort((a, b) => a.periods[0] - b.periods[0]);
  return out;
}
function subjByName(name) { return SUBJECTS.find((s) => s.name === name); }

// ============================================================
//  RENDER
// ============================================================
function renderAll() {
  const info = weekInfoFor(today());
  const wtxt = `${info.letter} · ${t("weekOf", { n: info.number, t: (CAT ? CAT.weeks : 20) })}`;
  ["weekBadge", "weekBadge2"].forEach((id) => { if ($(id)) $(id).textContent = wtxt; });
  ["secLabel", "secLabel2"].forEach((id) => { if ($(id)) $(id).textContent = SECTION; });
  renderToday(); renderOverview(); renderSubjects(); renderBuddies(); renderSettingsInfo();
}

function renderToday() {
  const wrap = $("todayList"); wrap.innerHTML = "";
  const hasSubjects = SUBJECTS.length > 0;
  $("firstRunCTA").style.display = hasSubjects ? "none" : "block";
  const dISO = iso(today());
  const slots = slotsToday();
  $("todayEmpty").style.display = (hasSubjects && slots.length === 0) ? "block" : "none";
  const di = dayInfo(today());
  $("todayEmptyText").textContent =
    di.reason === "holiday" ? t("noClassReason", { r: di.label }) :
    di.reason === "over" ? t("termOver") :
    di.reason === "before" ? t("termNotStarted") : t("noClassToday");
  $("todayTitle").textContent = `${t("todaysClasses")} · ${T[LANG].days[new Date().getDay()]}`;

  slots.forEach((sl) => {
    const subj = subjByName(sl.name);
    const loggedToday = subj && ABSENCES.some((a) => a.subject_id === subj.id && a.the_date === dISO);
    const times = sl.periods.map((p) => (CAT.periodTimes[p] || p)).join(", ");
    const pnums = sl.periods.join(", ");
    const card = document.createElement("div");
    card.className = "today-card" + (loggedToday ? " logged" : "");
    card.innerHTML = `
      <div class="bar" style="background:${sl.color}"></div>
      <div class="body">
        <div class="name">${escapeHtml(sl.name)}</div>
        <div class="meta">${t("periodShort")} ${escapeHtml(pnums)} · ${escapeHtml(times)}</div>
      </div>
      <button class="btn ${loggedToday ? "ghost" : "primary"} small mark">${loggedToday ? t("undo") : (t("absent") + " (" + sl.periods.length + ")")}</button>`;
    card.querySelector(".mark").onclick = () => loggedToday ? undoToday(subj, dISO) : markAbsentToday(sl, dISO);
    wrap.appendChild(card);
  });
}

async function markAbsentToday(sl, dISO) {
  const subj = subjByName(sl.name);
  if (!subj) { toast(t("signInFirst")); return; }
  await addAbsence(subj.id, dISO, sl.periods.length, "");
  toast(t("markedToday"));
}
async function undoToday(subj, dISO) {
  const rows = ABSENCES.filter((a) => a.subject_id === subj.id && a.the_date === dISO);
  for (const r of rows) await sb.from("absences").delete().eq("id", r.id);
  ABSENCES = ABSENCES.filter((a) => !(a.subject_id === subj.id && a.the_date === dISO));
  renderAll();
}

function renderOverview() {
  const wrap = $("overviewList"); wrap.innerHTML = "";
  $("overviewEmpty").style.display = SUBJECTS.length ? "none" : "block";
  const cards = SUBJECTS.map((s) => {
    const used = usedFor(s.id), planned = plannedFor(s.id); const st = statusOf(used + planned, s.budget);
    return { s, used, planned, ...st };
  }).sort((a, b) => a.left - b.left);   // worst first

  cards.forEach(({ s, used, planned, cls, left }) => {
    const rem = remainingSessions(s);
    const card = document.createElement("div");
    card.className = "subj-card " + cls;
    card.innerHTML = `
      <div class="bar" style="background:${s.color}"></div>
      <div class="body">
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="sub">${budgetLine(s, used, planned)}</div>
        ${rem != null ? `<div class="sub">${t("classesLeft", { n: rem })}</div>` : ""}
        ${meterHtml(s, used, planned)}
      </div>
      <div class="left"><b>${left < 0 ? 0 : left}</b><small>${t("left")}</small></div>`;
    card.onclick = () => openSubjectDetail(s);
    wrap.appendChild(card);
  });
}

function renderSubjects() {
  const wrap = $("subjectsList"); wrap.innerHTML = "";
  SUBJECTS.forEach((s) => {
    const used = usedFor(s.id), planned = plannedFor(s.id); const st = statusOf(used + planned, s.budget);
    const row = document.createElement("div");
    row.className = "subj-card " + st.cls;
    row.innerHTML = `
      <div class="bar" style="background:${s.color}"></div>
      <div class="body">
        <div class="name">${escapeHtml(s.name)} <span class="edit-hint">✏️</span></div>
        <div class="sub">${budgetLine(s, used, planned)}</div>
      </div>
      <div class="left"><b>${st.left < 0 ? 0 : st.left}</b><small>${t("left")}</small></div>`;
    row.onclick = () => openSubjectEdit(s);
    wrap.appendChild(row);
  });
}

function renderBuddies() {
  $("myCode").textContent = PROFILE ? PROFILE.share_code : "—";
  const wrap = $("friendsList"); wrap.innerHTML = "";
  $("friendsEmpty").style.display = BUDDIES.length ? "none" : "block";
  BUDDIES.forEach((b) => {
    const rows = b.subjects.map((s) => {
      const used = usedFor(s.id, b.absences), planned = plannedFor(s.id, b.absences);
      return { s, used, planned, ...statusOf(used + planned, s.budget) };
    }).sort((x, y) => x.left - y.left);
    const worst = rows.filter((r) => r.cls !== "ok").slice(0, 3);
    const shown = worst.length ? worst : rows.slice(0, 1);
    const card = document.createElement("div");
    card.className = "card friend-card";
    card.innerHTML = `
      <div class="setting-line">
        <div><div class="t">${escapeHtml(b.profile.display_name || "Guest")}</div>
          <div class="d">${escapeHtml(b.profile.section || "")} · ${worst.length ? t("closest") : t("allGood")}</div></div>
        <button class="btn ghost small rm">${t("removeFriend")}</button>
      </div>
      ${shown.map(({ s, used, planned, cls, left }) => `
        <div class="subj-card ${cls}" style="cursor:default;box-shadow:none;margin:10px 0 0;padding:10px 0;">
          <div class="bar" style="background:${s.color}"></div>
          <div class="body"><div class="name">${escapeHtml(s.name)}</div>
            <div class="sub">${budgetLine(s, used, planned)}</div>${meterHtml(s, used, planned)}</div>
          <div class="left"><b>${left < 0 ? 0 : left}</b><small>${t("left")}</small></div>
        </div>`).join("")}`;
    card.querySelector(".rm").onclick = () => unlinkBuddy(b);
    wrap.appendChild(card);
  });
}

function renderSettingsInfo() {
  $("mySectionName").textContent = SECTION;
  $("semInfo").textContent = CAT ? `${CAT.semester} · ${CAT.weeks} ${LANG === "th" ? "สัปดาห์" : "weeks"}` : "—";
  const cur = weekInfoFor(today()).letter;
  document.querySelectorAll("#thisWeekToggle button").forEach((b) => b.classList.toggle("active", b.dataset.week === cur));
}

// ============================================================
//  Absence CRUD
// ============================================================
async function addAbsence(subjectId, dISO, periods, note) {
  const row = { user_id: UID, subject_id: subjectId, the_date: dISO, periods, note: note || null };
  const { data, error } = await sb.from("absences").insert(row).select().single();
  if (error) { toast(t("couldntSave")); return null; }
  ABSENCES.push(data); renderAll(); return data;
}
async function deleteAbsence(id) {
  await sb.from("absences").delete().eq("id", id);
  ABSENCES = ABSENCES.filter((a) => a.id !== id);
}

// ============================================================
//  Sheets: subject detail, add absence, edit subject, pick section
// ============================================================
function openSheet(html) { $("sheetBody").innerHTML = html; $("sheet").classList.add("open"); $("backdrop").classList.add("open"); }
function closeSheet() { $("sheet").classList.remove("open"); $("backdrop").classList.remove("open"); }

function openSubjectDetail(s) {
  const used = usedFor(s.id), planned = plannedFor(s.id); const st = statusOf(used + planned, s.budget);
  const rem = remainingSessions(s); const cs = catSubject(s);
  const todayISO = iso(today());
  const rows = ABSENCES.filter((a) => a.subject_id === s.id).sort((a, b) => b.the_date.localeCompare(a.the_date));
  const list = rows.length ? rows.map((a) => {
    const d = new Date(a.the_date + "T00:00:00");
    const tag = a.the_date > todayISO ? ` <span class="tag-plan">${t("plannedTag")}</span>` : "";
    return `<div class="abs-row" data-id="${a.id}">
      <div style="flex:1;"><div class="d">${escapeHtml(fmtDate(d))}${tag}</div>${a.note ? `<div class="m">${escapeHtml(a.note)}</div>` : ""}</div>
      <span class="p">−${a.periods} ${t("periodShort")}</span>
      <button class="x" title="×">✕</button></div>`;
  }).join("") : `<p class="empty" style="padding:18px;">${t("noAbsences")}</p>`;

  openSheet(`
    <h2>${escapeHtml(s.name)}</h2>
    <div class="big-hero"><div class="n" style="color:${st.cls==="danger"?"var(--danger)":st.cls==="warn"?"var(--warn)":"var(--good)"}">${st.left < 0 ? 0 : st.left}</div>
      <div class="of">${t("left")} · ${budgetLine(s, used, planned)}</div>
      <div class="of">${cs && cs.credits ? t("creditsN", { c: cs.credits }) + " · " : ""}${rem != null ? t("classesLeft", { n: rem }) : ""}</div></div>
    ${st.left <= 0 ? `<p class="note" style="background:#fde8e8;color:var(--danger);text-align:center;">${t("overBudget")}</p>` : ""}
    <button class="btn primary" id="addAbsBtn" style="margin:8px 0 14px;">+ ${t("addAbsence")}</button>
    <div id="absList">${list}</div>
  `);
  $("addAbsBtn").onclick = () => openAddAbsence(s);
  $("absList").querySelectorAll(".abs-row .x").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.closest(".abs-row").dataset.id;
      if (!confirm(t("deleteAbsenceQ"))) return;
      await deleteAbsence(id);
      renderAll(); toast(t("deleted"));
      openSubjectDetail(SUBJECTS.find((x) => x.id === s.id) || s);
    };
  });
}

function openAddAbsence(s) {
  let val = 1;
  openSheet(`
    <h2>${t("addAbsence")}</h2>
    <div class="note">${escapeHtml(s.name)}</div>
    <p class="note" style="font-size:12px;">${t("plannedNote")}</p>
    <label class="field">${t("date")}</label>
    <input type="date" id="aDate" />
    <label class="field">${t("howManyPeriods")}</label>
    <div class="stepper"><button id="aMinus">−</button><span class="val" id="aVal">1</span><button id="aPlus">+</button></div>
    <label class="field">${t("noteOptional")}</label>
    <input type="text" id="aNote" placeholder="${t("notePh")}" />
    <button class="btn primary" id="aSave" style="margin-top:18px;">${t("save")}</button>
  `);
  $("aDate").value = iso(today());
  const upd = () => $("aVal").textContent = val;
  // pre-fill how many periods this subject has on the picked date
  const cs = catSubject(s);
  const autoFill = () => { const n = periodsOn(cs, new Date($("aDate").value + "T00:00:00")); if (n) { val = n; upd(); } };
  $("aDate").onchange = autoFill; autoFill();
  $("aMinus").onclick = () => { val = Math.max(1, val - 1); upd(); };
  $("aPlus").onclick = () => { val = Math.min(8, val + 1); upd(); };
  $("aSave").onclick = async () => {
    await addAbsence(s.id, $("aDate").value || iso(today()), val, $("aNote").value.trim());
    closeSheet(); toast(t("logged"));
  };
}

const EDIT_COLORS = ["#4f46e5","#16a34a","#d97706","#e11d48","#0ea5e9","#9333ea","#0891b2","#c026d3"];
function openSubjectEdit(s) {
  const isNew = !s;
  s = s || { name: "", sem_total: 40, budget: 8, color: EDIT_COLORS[0] };
  let chosen = s.color;
  openSheet(`
    <h2>${isNew ? t("addCustomSubject") : t("editSubject")}</h2>
    <label class="field">${t("subjectName")}</label>
    <input type="text" id="eName" value="${escapeHtml(s.name)}" />
    <label class="field">${t("totalPeriods")}</label>
    <input type="text" inputmode="numeric" id="eTotal" value="${s.sem_total}" />
    <label class="field">${t("budgetPeriods")}</label>
    <input type="text" inputmode="numeric" id="eBudget" value="${s.budget}" />
    <label class="field">${t("color")}</label>
    <div class="color-row" id="eColors"></div>
    <button class="btn primary" id="eSave" style="margin-top:18px;">${isNew ? t("save") : t("saveChanges")}</button>
    ${isNew ? "" : `<button class="btn ghost" id="eDel" style="margin-top:10px;color:var(--danger);border-color:var(--danger);">${t("deleteSubject")}</button>`}
  `);
  const cc = $("eColors");
  EDIT_COLORS.forEach((c) => {
    const dot = document.createElement("div");
    dot.className = "color-dot" + (c === chosen ? " sel" : "");
    dot.style.background = c;
    dot.onclick = () => { chosen = c; [...cc.children].forEach((x) => x.classList.remove("sel")); dot.classList.add("sel"); };
    cc.appendChild(dot);
  });
  // auto-suggest budget from total on total change
  $("eTotal").oninput = () => {
    const tot = parseInt($("eTotal").value, 10);
    if (!isNaN(tot)) $("eBudget").value = Math.floor(tot * ABSENT_LIMIT);
  };
  $("eSave").onclick = async () => {
    const name = $("eName").value.trim(); if (!name) { toast(t("saveFailed")); return; }
    const sem_total = parseInt($("eTotal").value, 10) || 0;
    const budget = parseInt($("eBudget").value, 10) || 0;
    if (isNew) {
      const sort = SUBJECTS.length;
      const { data, error } = await sb.from("subjects").insert({ user_id: UID, section: SECTION, semester: CAT.semester, code: null, name, sem_total, budget, color: chosen, sort }).select().single();
      if (error) { toast(t("saveFailed")); return; }
      SUBJECTS.push(data);
    } else {
      const { data, error } = await sb.from("subjects").update({ name, sem_total, budget, color: chosen }).eq("id", s.id).select().single();
      if (error) { toast(t("saveFailed")); return; }
      const i = SUBJECTS.findIndex((x) => x.id === s.id); if (i >= 0) SUBJECTS[i] = data;
    }
    closeSheet(); renderAll(); toast(t("saved"));
  };
  if (!isNew) $("eDel").onclick = async () => {
    if (!confirm(t("deleteSubjectQ"))) return;
    await sb.from("absences").delete().eq("subject_id", s.id);
    await sb.from("subjects").delete().eq("id", s.id);
    ABSENCES = ABSENCES.filter((a) => a.subject_id !== s.id);
    SUBJECTS = SUBJECTS.filter((x) => x.id !== s.id);
    closeSheet(); renderAll(); toast(t("deleted"));
  };
}

function openSectionPicker() {
  const secs = CAT ? Object.keys(CAT.sections) : [];
  const grid = secs.map((sec) => `<button type="button" class="preset${sec === SECTION ? " sel" : ""}" data-sec="${escapeHtml(sec)}">${escapeHtml(sec)}</button>`).join("");
  openSheet(`<h2>${t("pickYourSection")}</h2><p class="note">${t("pickSectionNote")}</p><div class="preset-grid">${grid}</div>`);
  document.querySelectorAll("#sheetBody .preset[data-sec]").forEach((b) => {
    b.onclick = () => switchSection(b.dataset.sec);
  });
}
async function switchSection(sec) {
  if (sec === SECTION) { closeSheet(); return; }
  if (SUBJECTS.length && !confirm(t("switchSectionQ", { s: sec }))) return;
  SECTION = sec; localStorage.setItem("atd_section", sec);
  closeSheet();
  await ensureSeeded(); await loadAll(); await saveProfile(); renderAll();
  toast(t("saved"));
}

// ============================================================
//  Backup export / import
// ============================================================
function exportBackup() {
  if (!SUBJECTS.length) { toast(t("noData")); return; }
  const payload = {
    section: SECTION,
    subjects: SUBJECTS.map((s) => ({ id: s.id, code: s.code, name: s.name, sem_total: s.sem_total, budget: s.budget, color: s.color, sort: s.sort })),
    absences: ABSENCES.map((a) => ({ subject_id: a.subject_id, the_date: a.the_date, periods: a.periods, note: a.note })),
  };
  const code = "AB1:" + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  openSheet(`<h2>${t("backupTitle")}</h2><p class="note">${t("backupDesc")}</p><div class="code-box" id="codeBox">${code}</div><button class="btn primary" id="copyCode" style="margin-top:14px;">${t("exportBackup")}</button>`);
  $("copyCode").onclick = async () => {
    try { await navigator.clipboard.writeText(code); toast(t("copied")); } catch { toast(t("copyManually")); }
  };
}
async function importBackup() {
  const code = prompt(t("pasteCodePrompt")); if (!code) return;
  try {
    if (!code.startsWith("AB1:")) throw new Error("bad");
    const p = JSON.parse(decodeURIComponent(escape(atob(code.slice(4)))));
    if (!confirm(t("restoreConfirm"))) return;
    SECTION = p.section || SECTION; localStorage.setItem("atd_section", SECTION);
    // wipe this section then restore
    await sb.from("subjects").delete().eq("user_id", UID).eq("section", SECTION).eq("semester", CAT.semester);
    const idMap = {};
    for (const s of p.subjects) {
      const { data } = await sb.from("subjects").insert({ user_id: UID, section: SECTION, semester: CAT.semester, code: s.code, name: s.name, sem_total: s.sem_total, budget: s.budget, color: s.color, sort: s.sort }).select().single();
      if (data) idMap[s.id] = data.id;
    }
    const absRows = (p.absences || []).map((a) => ({ user_id: UID, subject_id: idMap[a.subject_id], the_date: a.the_date, periods: a.periods, note: a.note })).filter((a) => a.subject_id);
    if (absRows.length) await sb.from("absences").insert(absRows);
    await loadAll(); renderAll(); toast(t("restored"));
  } catch { toast(t("codeDidntWork")); }
}

// ============================================================
//  Wiring + i18n application
// ============================================================
function wireTabs() {
  document.querySelectorAll(".tabbar button").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".tabbar button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
      $("screen-" + btn.dataset.tab).classList.add("active");
    };
  });
}
function wireSettings() {
  $("nameInput").value = localStorage.getItem("atd_name") || "";
  $("saveNameBtn").onclick = async () => {
    const n = $("nameInput").value.trim() || "Guest";
    localStorage.setItem("atd_name", n); $("whoami").textContent = n;
    await saveProfile(); toast(t("saved"));
  };
  $("linkBtn").onclick = () => { const c = $("friendCode").value; if (c.trim()) linkBuddy(c).then(() => $("friendCode").value = ""); };
  $("copyMyCode").onclick = async () => {
    if (!PROFILE) return;
    try { await navigator.clipboard.writeText(PROFILE.share_code); toast(t("copied")); } catch { toast(t("copyManually")); }
  };
  $("pickSectionBtn").onclick = openSectionPicker;
  $("pickSectionCta").onclick = openSectionPicker;
  $("addSubjBtn").onclick = () => openSubjectEdit(null);
  $("exportBtn").onclick = exportBackup;
  $("importBtn").onclick = importBackup;
  document.querySelectorAll("#thisWeekToggle button").forEach((b) => b.onclick = () => setThisWeek(b.dataset.week));
  document.querySelectorAll("#langToggle button").forEach((b) => b.onclick = () => setLang(b.dataset.lang));
}
function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll("#langToggle button").forEach((b) => b.classList.toggle("active", b.dataset.lang === LANG));
}
function setLang(lang) {
  if (lang === LANG) return;
  LANG = lang; localStorage.setItem("atd_lang", lang); document.documentElement.lang = lang;
  applyStaticI18n(); renderAll();
  if ($("authBanner")) showAuthBanner();
}
