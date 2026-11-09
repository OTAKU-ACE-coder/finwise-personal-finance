# FinWise reports, export, and visual polish Implementation Plan

> **For agentic workers:** Implement inline in the existing workspace. Keep the change dependency-free and preserve current finance calculations.

**Goal:** Add monthly reporting and transaction export, refresh icons and screen polish, update preview screenshots, and publish the result.

**Architecture:** Derive report totals from transaction records in `app.js`; add one Reports page and an export action in the existing navigation and activity screen. Use inline SVG for shared navigation icons, style with the existing CSS, then verify and capture the finished views.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js static/local server.

**Spec:** `docs/superpowers/specs/2026-11-09-finwise-reports-and-icons-design.md`

## Global Constraints
- Preserve existing calculations and saved data.
- Do not add dependencies or require a hosted backend.
- Keep mobile navigation and light/dark themes functional.
- Keep CSV export limited to transaction fields.

## Review Focus
- Months with no activity show zero totals and an empty state.
- CSV descriptions containing commas, quotes, or newlines remain valid CSV.
- Narrow screens retain usable navigation and report cards.
- Dark theme keeps report text and controls readable.
- Existing stored data without new fields still loads unchanged.

### Task 1: Reports and CSV export

**Files:** Modify `index.html`, `app.js`, `styles.css`.

- Add Reports to desktop and mobile navigation.
- Derive the last six calendar months' income, spending, and net cash flow from transactions and render a responsive report with a clear empty state.
- Add a transaction CSV download action; escape fields per CSV quoting rules and export signed amounts without account credentials or profile data.

### Task 2: Icon and visual refresh

**Files:** Modify `index.html`, `app.js`, `styles.css`.

- Replace navigation glyphs with accessible, consistent inline SVG icons.
- Refine spacing, hierarchy, focus states, and responsive presentation across dashboard and report while retaining both themes.
- Review the dashboard, report, notifications, and settings at desktop and phone sizes; inspect dark mode.

### Task 3: Preview and release

**Files:** Update `previews/dashboard.png`, `previews/notifications.png`, and README screenshots if needed.

- Refresh dashboard and notification preview images. **Blocked:** the browser rejected saving a captured page image to the workspace and explicitly disallowed alternate routes; leave the existing images untouched pending user input.
- Run JavaScript syntax checks and inspect the changed files.
- Commit and push the requested update to GitHub; verify the deployed GitHub Pages URL opens with the finished UI.
