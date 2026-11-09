# FinWise reports, export, and visual polish

## Intent
Make FinWise feel more professional and useful by adding a monthly cash-flow report, transaction export, and a consistent icon set while preserving the existing finance data and calculations.

## Goals
- Add a Reports screen showing monthly income, spending, and net cash flow from recorded transactions.
- Allow the user to export all transactions as a spreadsheet-friendly CSV.
- Replace navigation's text glyphs with accessible inline SVG icons and polish the dashboard and mobile layouts.
- Keep light/dark themes, existing pages, mobile navigation, and static GitHub Pages behavior working.
- Refresh the committed screenshots to match the shipped interface.

## Non-goals
- Change balance, budget, bill, or savings calculations.
- Add dependencies, authentication services, or a backend requirement.
- Include passwords or account details in exports.

## Approaches
- Add a Reports page to the current app and derive its figures directly from transactions (chosen: fits the existing page/navigation pattern, requires no new stored data).
- Add a separate analytics framework or persist aggregates (rejected: adds dependencies and risks stale totals).
- Keep only the existing dashboard (rejected: does not satisfy the requested app expansion).

## Constraints and calls
- Use the existing vanilla HTML, CSS, and JavaScript stack.
- Export transaction date, description, category, type, and signed amount; quote CSV fields safely and trigger a browser download.
- Use inline SVG for navigation icons with accessible hidden labels; retain expressive transaction and savings illustrations.
- Refresh dashboard and notification preview images after checking desktop, phone, and dark-theme layouts.
- Publish the completed static preview through the existing GitHub Pages workflow, as requested.
