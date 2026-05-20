# Planner

A lightweight, browser-based task planner built with React, TypeScript, and Vite. Tasks are organized into two columns — **Today** and **Ever** — and completing them earns points toward milestones. All state is persisted in `localStorage` and the "Today" column auto-clears completed tasks each day at 6am.

## Features

- **Two columns**: `Today` for what you're working on now, `Ever` for the backlog of things you might do someday.
- **Color-coded priority**: each task is green (50 pts), yellow (100 pts), or red (200 pts). Yellow and red tasks also collect any banked points from previously-completed green tasks.
- **Progress bar & milestones**: track points up to 50,000, with milestones at 5k / 10k / 20k / 50k. Spend points to redeem rewards.
- **Slice / Do / Nah workflow**: pull an `Ever` task into `Today` (slice), promote it directly (do), or push a `Today` task back to `Ever` (nah).
- **Auto-reset**: completed tasks clear daily at 6am local time.
- **Offline-first**: state lives entirely in `localStorage` — no backend, no account.

## Tech stack

- React 18
- TypeScript 5
- Vite 5

## Installation

Prerequisites: **Node.js 18+** and npm.

```bash
git clone <repository-url>
cd planner
npm install
```

## Usage

Start the dev server:

```bash
npm run dev
```

Then open the URL printed in the terminal (usually `http://localhost:5173`).

### Build for production

```bash
npm run build
```

The bundled output is written to `dist/`.

### Preview the production build

```bash
npm run preview
```

## Project structure

```
src/
  App.tsx              Top-level layout and dispatch wiring
  main.tsx             React entry point
  store.ts             Reducer + localStorage persistence + daily reset
  types.ts             Shared types and point/milestone constants
  reset.ts             6am rollover helper
  styles.css           Global styles
  components/
    ProgressBar.tsx
    MilestoneButton.tsx
    TaskColumn.tsx
    TaskRow.tsx
```
