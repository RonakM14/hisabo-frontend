# Hisabo Frontend

React 19.3 + TypeScript 7 + Vite 8 + Apache ECharts 6. The companion Java 25 project is `hisabo-backend`; both are independent repositories.

## Quick start — both apps

Requirements: **JDK 25** and **Node.js 24 LTS** (Node 22.12+ is also accepted), with npm. Put the two repositories next to each other:

```text
workspace/
  hisabo-backend/
  hisabo-frontend/
```

From this frontend directory:

```sh
npm ci
npm run dev:all
```

Your browser opens **http://hisabo.localhost:5173** automatically. The launcher waits for Java on port 8080, then starts Vite on 5173. Ctrl+C stops both. The first run downloads the backend's Maven dependencies. The backend must be stopped before using `dev:all`; otherwise the launcher explains how to connect to an already running instance.

If the backend is elsewhere, set `LEDGER_BACKEND_DIR` to its path in your environment or an untracked `.env` file. `BACKEND_URL` defaults to `http://127.0.0.1:8080`.

## Your local Hisabo address

The app uses **http://hisabo.localhost:5173** for development and **http://hisabo.localhost:4173** for a production-build preview. The browser tab is titled **Hisabo · Financial workspace**. Both `npm run dev` and `npm run dev:all` open the named development address; `npm run preview` opens the preview address. Set `BROWSER=none` in `.env` if you prefer to open it manually.

`.localhost` is a local browser address: the app stays on your computer, with no domain purchase or hosts-file edit needed in current Chrome, Edge, and Firefox. If a browser or proxy cannot resolve it, use `http://127.0.0.1:5173` as a fallback. The Java API remains on `127.0.0.1:8080` internally; the website reaches it through `/api`. A public address such as `hisabo.com` would require a domain you control and a separate deployment.

References: [local addresses in browsers](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts), [Vite hostname support](https://vite.dev/config/server-options#server-allowedhosts).

## IntelliJ IDEA + Visual Studio Code

1. Open `hisabo-backend/pom.xml` in IntelliJ and set the project SDK and Maven runner JRE to Java 25.
2. Run or debug `com.hisabo.HisaboApplication` using the included **Hisabo Backend** run configuration.
3. Open this frontend directory in VS Code. Run `npm ci` once, then `npm run dev` in its terminal.
4. Open `http://hisabo.localhost:5173`. Vite forwards `/api` calls to Java; changes are written to the backend's annual XML file.
5. In VS Code, use **Run and Debug → Hisabo: React in Chrome** or **React in Edge** for frontend breakpoints. Keep the backend debugger running in IntelliJ.

You can also open the supplied `Hisabo.code-workspace` beside both directories to see both projects in VS Code. The backend includes a Java launch configuration for the Java Extension Pack. No IDE installation or settings on your computer have been changed.

For **full Visual Studio** on Windows, open this folder and run `npm ci` / `npm run dev` in the integrated terminal. Keep Java in IntelliJ. The supplied `.vscode` debugger files specifically target **Visual Studio Code**; a `.sln` project is not required for this React application.

## Commands

| Command           | Purpose                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `npm run dev:all` | Start both backend and frontend                                             |
| `npm run dev`     | Start frontend only; connect to an existing backend                         |
| `npm run build`   | Type-check and create the production bundle in `dist/`                      |
| `npm run preview` | Preview that bundle on `http://hisabo.localhost:4173`, with the same backend proxy |
| `npm test`        | Run financial-calculation and transaction-filter tests                      |

The frontend is a running application: do not double-click `index.html`. Use Vite or a web server with `/api` forwarding configured. Java must be running to load or save a ledger.

## Features

- Enterprise light interface with a navy sidebar and responsive mobile navigation.
- Twelve month tabs for each year; years 2000–2100 can be selected.
- Net cash flow, monthly spending, remaining budget, and savings-rate cards.
- Interactive cash-flow chart with six-month and full-year views.
- Category doughnut chart and daily spending calendar.
- Monthly category budgets with progress and over-budget states.
- Create, edit, and delete income and expense transactions.
- Search, type filters, numeric/date sorting, and pagination.
- Keyboard-accessible forms and dialogs, reduced-motion support, and loading/error states.

## How persistence works

The browser fetches a full year from the Java API when opened or when the year changes. The month tabs select that year's monthly section. A successful edit receives the saved year back from Java and updates the charts and table. Refresh reloads the XML from the backend. No transactions are stored in localStorage.

The backend writes `data/ledger-YYYY.xml` with twelve `<month>` sections and maintains one previous-version `.bak`. A revision number prevents stale edits from overwriting another window's changes. If a save times out, refresh before retrying; the backend may already have saved it.

The initial sample ledger is labelled in the UI. See the backend README to start with empty data or choose a different storage directory. This is a local single-user application, not a hosted multi-user finance service.

## Project structure

```text
src/
  App.tsx         # Workspace, month tabs, tables, forms, and dialogs
  Charts.tsx      # ECharts integration and sparklines
  api.ts          # Typed API client and error handling
  data.ts         # Cent-based calculations and transaction filtering
  data.test.ts    # Calculation, leap-year, search, and sorting tests
  types.ts        # Shared frontend domain types
  styles.css      # Responsive theme
scripts/
  dev-all.mjs     # Cross-platform combined launcher
.vscode/          # VS Code tasks and browser debug configurations
```

## Troubleshooting

- **Backend unavailable:** start Java, check `/api/health`, and click Refresh. The frontend never pretends an unsaved transaction is saved.
- **Port 8080 is in use:** if IntelliJ is already running Java, use `npm run dev`, not `dev:all`.
- **Port 5173 is in use:** stop the existing frontend instance. The development server uses a strict port to avoid an unnoticed connection mismatch.
- **Java release 25 not supported:** check `JAVA_HOME`, IntelliJ Project SDK, and Maven runner JRE.
- **Different data between runs:** set the same absolute `LEDGER_DATA_DIR` in all launch environments.
- **Changed API port:** set `BACKEND_URL=http://127.0.0.1:YOUR_PORT` in `.env`; restart Vite. When starting Java separately, set its `PORT` too.
- **Fonts unavailable offline:** system fonts are used. The optional Google Fonts request contains no transaction data.

Framework references: [React versions](https://react.dev/versions), [Vite setup](https://vite.dev/guide/).
