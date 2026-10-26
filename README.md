# 🎓 Absence Budget

A phone web app (PWA) that tracks Chitralada's **20%-per-subject** absence rule for M.6.
Pick your section and every subject loads with its total periods and 20% budget already
calculated from the school timetable. Log a missed class in one tap and see how many
absences you have left per subject.

- **Today** — your real classes for today (A/B week aware); tap to log an absence
- **Overview** — every subject, worst-first, with a bar and "N left" (green → amber → red)
- **Subjects** — adjust totals/budgets if the school counts differently
- **Friends** — swap a 6-letter code with a friend to see each other's closest-to-limit subjects (read-only)
- **Settings** — switch section, EN/ไทย, backup code

Static site (no build step). Data syncs to Supabase (`attendance` schema) with anonymous sign-in.
Semester data: 2/2569. Rebuild with `py -I tools/build-catalog.py "<schedule.xlsx>" > catalog.json`
(term dates/holidays are typed into the script from the academic-calendar PDF).
Budget = 20% of credit hours (0.5 credit = 20 periods). Future-dated absences count as *planned*.
DB changes: `supabase/migrations/`.
