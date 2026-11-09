# FinWise visual refresh and CSS cleanup

Date: 2026-11-09

## Intent
Give FinWise a clearer, more professional personal-finance look while making its stylesheet easy to read and edit. The hosted GitHub Pages preview should remain usable on phones.

## Goals
- Use a modern fintech visual style: clear typography and hierarchy, generous spacing, polished cards, and a restrained green accent.
- Reformat the current compressed CSS into readable multi-line rules without changing behavior just for formatting.
- Keep all existing pages, settings, notifications, and data behavior working.
- Maintain responsive mobile navigation and light/dark theme support.

## Non-goals
- Add features or change financial calculations.
- Replace the app stack, add dependencies, or require a paid hosting service.

## Approaches considered
- Modern fintech refresh (chosen): improve the existing visual system and layouts while preserving FinWise's recognizable green palette; best balance of polish and familiarity.
- Premium dark redesign: a dramatic dark-first interface; conflicts with the current light default and requires broader theme decisions.
- CSS formatting only: improves maintainability but leaves the requested visual design unchanged.

## Implementation notes
Make the visual changes in the existing HTML/CSS/JS, prioritizing dashboard hierarchy, navigation, cards, forms, and responsive spacing. Preserve the current app behavior and color-theme switch. Reformat CSS into conventional multi-line declarations. Update the GitHub Pages preview after visual review.
