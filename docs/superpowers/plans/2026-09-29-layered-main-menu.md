# Layered Main Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG prototype with a three-layer raster hero, restrained ambient motion, and card-slice navigation while preserving every current main-menu action.

**Architecture:** The image model produces one environment image and two transparent overlays under `assets/menu/`. A small exact allowlist serves those files through the existing `app://desktop/` protocol; React composes them as decorative layers and native CSS supplies motion and button feedback.

**Tech Stack:** Electron 44.3, React 19.3, TypeScript 7, esbuild, native CSS, built-in image generation.

**Spec:** `game/desktop/DESIGN.md`

## Global Constraints

- Main menu only; do not change rules, network, profile storage, preload, worker behavior, or other pages.
- No SVG character, remote asset, new runtime dependency, UI library, animation library, Canvas, or WebGL.
- Generated art must be original, text-free, watermark-free, and free of recognizable franchise identity.
- Preserve all five menu actions, profile status, developer preview, native buttons, visible focus, disabled states, and reduced-motion behavior.
- Keep CSP, denied permissions, denied navigation, and the exact local asset allowlist intact.

## Review Focus

- A traversal or unknown `app://desktop/` asset path returns 403 and never reaches arbitrary files.
- A missing generated asset returns 404 while CSS fallback keeps the menu readable and clickable.
- 1000×650 does not clip the fifth menu action or put the character over the title.
- Reduced-motion disables continuous drift and staggered entrance animations.
- Packaged builds include the exact three menu assets and the allowlist module.

---

### Task 1: Generate and securely package the menu asset set

**Files:**
- Create: `game/desktop/assets/menu/menu-environment.webp`
- Create: `game/desktop/assets/menu/menu-character.png`
- Create: `game/desktop/assets/menu/menu-atmosphere.png`
- Create: `game/desktop/ui-assets.cjs`
- Modify: `game/desktop/build.cjs`
- Modify: `game/desktop/dev.cjs`
- Modify: `game/desktop/main.cjs`
- Modify: `game/desktop/test-packaging.cjs`
- Modify: `game/packaging/build.py`

**Interfaces:**
- Produces: `UI_ASSETS: Readonly<Record<string, string>>` and `resolveUiAsset(name: string): null | { relativePath: string, contentType: string }`.
- Consumes: three image outputs generated from the approved `DESIGN.md` asset briefs.

- [ ] **Step 1: Generate and inspect the three assets**

Use built-in image generation once per asset. Save final files at the exact paths above, inspect each output, convert/compress only as needed, and reject any text, watermark, weapon, school uniform, franchise likeness, or busy right-side composition.

- [ ] **Step 2: Add failing allowlist and packaging tests**

Add `test('R04 menu assets use an exact local allowlist')` asserting the three valid paths and MIME types, plus `null` for `../main.cjs`, encoded traversal, and unknown assets. Add `test('R04 built UI contains the three bounded menu assets')` asserting existence and the spec size ceilings.

- [ ] **Step 3: Verify the tests fail**

Run: `node --test test-packaging.cjs`

Expected: FAIL because `ui-assets.cjs` and built assets do not exist.

- [ ] **Step 4: Implement the exact asset pipeline**

Implement `ui-assets.cjs`, make `build.cjs` copy only `assets/menu/` into `build/ui/assets/menu/`, extend `dev.cjs` to rebuild on that directory, serve only `resolveUiAsset()` results in `main.cjs`, and add the module and built asset paths to `game/packaging/build.py::STAGE_FILES`.

- [ ] **Step 5: Verify asset security and packaging inputs**

Run: `npm run build && node --test test-packaging.cjs`

Expected: PASS; the three built assets exist and traversal/unknown paths are rejected.

- [ ] **Step 6: Commit**

Commit only Task 1 files with message `feat: add layered menu assets`.

### Task 2: Compose the dynamic hero and card-slice navigation

**Files:**
- Modify: `game/desktop/renderer.tsx`
- Modify: `game/desktop/style.css`
- Modify: `docs/results/R04-T01-b/NOTES.md`
- Modify: `docs/production/STATUS.md`

**Interfaces:**
- Consumes: `app://desktop/assets/menu/menu-environment.webp`, `menu-character.png`, and `menu-atmosphere.png`.
- Produces: the existing `page === 'menu'` flow with unchanged click handlers and new decorative raster layers.

- [ ] **Step 1: Replace the SVG and glass panel markup**

Delete `MenuArtwork`; add three decorative `img` layers with empty alt text and `aria-hidden`; keep all existing actions but place them in a shared card-slice navigation rail.

- [ ] **Step 2: Implement layout, motion, and fallbacks**

Implement the approved 58/42 composition, environment/character/atmosphere z-order, CSS fallback background, slow transform/opacity-only ambient motion, card-slice hover/focus/active/disabled states, and reduced-motion overrides.

- [ ] **Step 3: Run focused checks**

Run: `npm run typecheck && npm run build && node --test test-navigation.cjs test-packaging.cjs && git diff --check`

Expected: all checks PASS.

- [ ] **Step 4: Inspect the real Electron UI**

Run: `DEIDEI_PYTHON=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 npm run dev`. Inspect 1366×768, then 1000×650 and 1920×1080; confirm hot reload, five actions, focus, no overlap, and reduced-motion fallback.

- [ ] **Step 5: Update evidence and commit**

Record the actual asset paths, commands, window checks, known visual compromises, and live dev-session status. Commit Task 2 files with message `feat: redesign the main menu`.
