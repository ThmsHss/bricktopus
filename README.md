<p align="center">
  <img src="images/bricktopus_icon_png.png" alt="Bricktopus" width="160" />
</p>

<h1 align="center">Bricktopus</h1>

<p align="center">
  The field-engineering control center for a Databricks account.<br />
  One pane of glass over consumption, engagement, anomalies, tasks, and the next best moves an account team should make this week.
</p>

---

## What it is

Bricktopus pulls signal from every place a Databricks Field Engineering team works — Salesforce, Logfood, Slack, Gmail, meeting notes, Glean, Google Drive, prospect research — and turns it into a daily briefing, a ranked list of next best actions, and a set of automations (draft emails, meeting prep, task tracking, irrelevant-call pushback).

This repo is the local-first MVP. Today it ships a polished UI fed by a typed `MockDataSource` for **PUMA**. The toggle in the top-right header switches between mock and real data; real adapters land iteratively.

## Stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind 4, shadcn/ui, TanStack Router + Query, recharts
- **Backend** — Python 3.11, FastAPI, Pydantic, Databricks SDK
- **Tooling** — [apx](https://github.com/databricks-solutions/apx) for scaffolding, dev orchestration, and Databricks Apps deployment; Bun for frontend deps; uv for Python deps

## Run it locally

Prerequisites: `apx` CLI installed, `uv`, and `bun`.

```bash
# Start all dev servers (FastAPI backend + Vite frontend + OpenAPI watcher)
apx dev start

# Then open the URL printed by apx (http://localhost:8000 by default).
# The first run will sync Python deps via uv.
```

Useful commands:

```bash
apx dev status      # see which servers are running
apx dev logs -f     # stream logs
apx dev check       # tsc + Python type check
apx dev stop        # stop everything
```

## Project layout

```
src/bricktopus/
├── backend/                  # FastAPI app + Databricks dependencies
└── ui/
    ├── components/
    │   ├── apx/              # shell pieces: Logo, CustomerPicker, DataModeToggle, sidebar layout
    │   ├── overview/         # 6 hero cards on the Overview page
    │   └── ui/               # shadcn primitives
    ├── data/
    │   ├── source.ts         # DataSource interface — single seam for mock vs. real
    │   ├── mock-source.ts    # in-memory mock backed by typed fixtures
    │   ├── mock/puma.ts      # PUMA fixture (12mo spend, anomalies, tasks, NBAs, ...)
    │   ├── real-source.ts    # stub raising RealNotImplementedError until adapters land
    │   ├── context.tsx       # BricktopusProvider — persisted mode + selected customer
    │   └── types.ts          # domain types
    ├── hooks/
    │   └── use-overview.ts   # @tanstack/react-query hooks over the DataSource
    ├── lib/
    │   └── format.ts         # USD compact, percent, relative-day formatters
    ├── routes/               # TanStack Router file routes
    │   ├── index.tsx         # redirects to /overview
    │   └── _sidebar/         # Overview + section stubs (Account & Org, Consumption, ...)
    └── styles/globals.css    # design tokens (light editorial, Bricktopus red accent)
```

## What ships in the MVP

- **Overview** — bento layout with six hero cards: today's briefing, octopus-suggested next best actions, 12-month spend with current-month forecast, engagement health (covered + gap teams), anomalies, open tasks
- **App shell** — header with customer picker (PUMA preselected), mock/real toggle in the top-right, theme toggle; sidebar nav grouped Account / Pipeline / Workflow
- **Data layer** — typed `DataSource` interface with mock and stub-real implementations, persisted via React Context

The other section pages (Account & Org, Consumption, Use cases, Activity, Tasks, Meetings) render `PageStub` until their full surfaces ship.

## Roadmap

- **Phase 2** — Account & Org page (org chart, engagement gaps from LinkedIn) + Consumption page (workspace + SKU drilldowns)
- **Phase 3** — Use cases (peer-derived prospect ideas) + Activity (unified Slack/email/notes timeline)
- **Phase 4** — Tasks + Automations (parsed from email + meeting notes, draft emails, meeting prep)
- **Phase 5** — Wire real adapters: Salesforce, Logfood, Slack, Glean, Google Drive — replacing `RealDataSource` stubs
- **Phase 6** — Package as a Databricks App via `databricks bundle deploy`

## Deploy as a Databricks App

```bash
apx build
databricks bundle deploy -p <your-profile>
```

`app.yml` and `databricks.yml` are wired by the apx scaffold and ready for Databricks Apps once the real adapters are in place.
