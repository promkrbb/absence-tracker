"""Build catalog.json from Chitralada's class-schedule xlsx (master sheet R1).

Usage:  py -I tools/build-catalog.py "<schedule.xlsx>" > catalog.json

R1 has one row per weekly teaching slot (rows repeat per teacher):
  C=subject code  D=name  E=section (e.g. ม.6/2ย)  G=period ("4" or "1-2")  H=Thai day  I=week A/B
Totals follow the credit rule: 0.5 credit = 1 period/week = 20 periods/term,
so semTotal = per2wk * 10 and budget = floor(semTotal * 20%).
The academic-calendar facts below are typed in by hand from the school's PDF.
"""
import sys, zipfile, re, html, json, math
from collections import defaultdict

SEMESTER = "2/2569"
WEEKS = 20
WEEK_ANCHOR = {"week": 2, "letter": "B", "monday": "2026-10-26"}
CALENDAR = {
    "start": "2026-10-26",
    "lastClass": "2027-02-05",      # M.6 final theory exams start Feb 8
    "noClass": [
        {"date": "2026-12-07", "en": "Father's Day (substitute)", "th": "วันหยุดชดเชยวันพ่อแห่งชาติ"},
        {"date": "2026-12-10", "en": "Constitution Day", "th": "วันรัฐธรรมนูญ"},
        {"date": "2026-12-16", "en": "Special holiday", "th": "วันหยุดราชการกรณีพิเศษ"},
        {"date": "2026-12-21", "en": "Midterm exam", "th": "สอบกลางภาค"},
        {"date": "2026-12-22", "en": "Exam study day", "th": "หยุดอ่านหนังสือสอบ"},
        {"date": "2026-12-23", "en": "Midterm exam", "th": "สอบกลางภาค"},
        {"date": "2026-12-24", "en": "Exam study day", "th": "หยุดอ่านหนังสือสอบ"},
        {"date": "2026-12-25", "en": "Midterm exam", "th": "สอบกลางภาค"},
        {"date": "2027-01-01", "en": "New Year's Day", "th": "วันขึ้นปีใหม่"},
    ],
}
DAYS = {"จันทร์": 1, "อังคาร": 2, "พุธ": 3, "พฤหัสบดี": 4, "ศุกร์": 5}
PERIOD_TIMES = {"0": "7.45", "1": "8.00-8.50", "2": "8.50-9.40", "3": "9.50-10.40", "4": "10.40-11.30",
                "5": "12.30-13.20", "6": "13.20-14.10", "7": "14.10-15.00", "8": "15.00-15.50"}
COLORS = ["#4f46e5", "#0891b2", "#16a34a", "#d97706", "#e11d48", "#9333ea", "#0ea5e9", "#c026d3"]


def read_rows(xlsx, sheet="xl/worksheets/sheet33.xml"):
    z = zipfile.ZipFile(xlsx)
    ss = [html.unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S)))
          for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S)]
    for r in re.finditer(r"<row [^>]*>(.*?)</row>", z.read(sheet).decode(), re.S):
        d = {}
        for c in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', r.group(1), re.S):
            col, attrs, body = c.groups()
            v = body and re.search(r"<v>(.*?)</v>", body, re.S)
            if not v:
                continue
            d[col] = ss[int(v.group(1))] if 't="s"' in attrs else html.unescape(v.group(1))
        yield d


def periods(g):
    g = str(g).strip()
    if "-" in g:
        a, b = g.split("-")
        return list(range(int(a), int(b) + 1))
    try:
        return [int(float(g))]
    except ValueError:
        return []


def main(xlsx):
    slots = defaultdict(lambda: defaultdict(set))   # section -> code -> {(week, day, period)}
    names = {}
    for r in read_rows(xlsx):
        sec = r.get("E", "").strip()
        if not sec.startswith("ม.6"):
            continue
        day, week = DAYS.get(r.get("H", "").strip()), r.get("I", "").strip()
        if not day or week not in ("A", "B"):
            continue
        # "ท 33102" == "ท33102"; "ย33203(1)"/"(2)" are one subject split between teachers
        code = re.sub(r"\(\d+\)$", "", re.sub(r"\s+", "", r.get("C", "")))
        names.setdefault((sec, code), re.sub(r"\s*\(\d+\)$", "", r.get("D", "").strip()))
        for p in periods(r.get("G", "")):
            slots[sec][code].add((week, day, p))

    sections = {}
    for sec in sorted(slots):
        subs = []
        for code, cells in slots[sec].items():
            per2wk = len(cells)
            total = per2wk * WEEKS // 2
            subs.append({
                "code": code, "name": names[(sec, code)], "per2wk": per2wk, "credits": per2wk / 4,
                "semTotal": total, "budget": math.floor(total * 0.2),
                "slots": [{"week": w, "day": d, "period": p} for w, d, p in sorted(cells)],
            })
        subs.sort(key=lambda s: (-s["per2wk"], s["code"]))
        for i, s in enumerate(subs):
            s["color"] = COLORS[i % len(COLORS)]
        sections[sec] = {"subjects": subs}

    cat = {"semester": SEMESTER, "weeks": WEEKS, "weekAnchor": WEEK_ANCHOR, "calendar": CALENDAR,
           "days": {str(v): k for k, v in DAYS.items()}, "periodTimes": PERIOD_TIMES, "sections": sections}
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(cat, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
