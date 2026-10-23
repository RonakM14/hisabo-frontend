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
- Unlimited named profiles: create, rename, and switch with separate transactions, budgets, and charts.
- Automatic Excel workbook per profile/year, with an annual overview and 12 monthly tabs; download from the dashboard.
- Twelve month tabs for each year; years 2000–2100 can be selected.
- Net cash flow, monthly spending, remaining budget, and savings-rate cards.
- Interactive cash-flow chart with six-month and full-year views.
- Category doughnut chart and daily spending calendar.
- Monthly category budgets with progress and over-budget states.
- Create, edit, and delete income and expense transactions.
- Search, type filters, numeric/date sorting, and pagination.
- Keyboard-accessible forms and dialogs, reduced-motion support, and loading/error states.

## How persistence works

The browser fetches a full year from the Java API when opened or when the profile or year changes. The month tabs select that year's monthly section. A successful edit receives the saved year back from Java and updates the charts and table. Refresh reloads the XML from the backend. No transactions are stored in localStorage; only the selected profile ID is remembered.

The original Personal profile keeps `data/ledger-YYYY.xml`. Additional profiles use `data/profiles/<profile-id>/ledger-YYYY.xml`. The backend writes each year atomically with twelve `<month>` sections and maintains one previous-version `.bak`. A revision number prevents stale edits from overwriting another window's changes. If a save times out, refresh before retrying; the backend may already have saved it.

New profiles start empty. The optional demo ledger is labelled in the UI. See the backend README to opt into demo data or choose a different storage directory. This is a local single-user application, not a hosted multi-user finance service.

## Using profiles and Excel

Click your name at the top right or **Manage profiles** in the sidebar. Enter a name and choose **Create profile**; use the pencil beside a profile to rename it. A new profile opens immediately with an empty ledger. Switching profiles changes all charts, totals, transactions, and budgets together.

**Download Excel** gives you a workbook such as `Ronak-2026.xlsx`. The backend keeps the workbook in that profile's `excel` directory and updates it after saving. XML is still the saved source of truth: make changes in Hisabo, because edits made in Excel do not sync back. The default Personal profile's files are in `hisabo-backend/data/excel`; other profiles' files are in `hisabo-backend/data/profiles/<profile-id>/excel`.

After updating this feature, reload the Maven project and restart the Java backend in IntelliJ, then refresh the browser. Keep your existing `data` folder. The backend exposes new `/api/profiles` endpoints; an older running backend will show a restart message.

## Project structure

```text
src/
  App.tsx         # Workspace, month tabs, tables, forms, and dialogs
  ProfileManager.tsx # Create, rename, and switch profiles
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

## Home & mortgage template

When creating a new profile, optionally choose **Home & mortgage**. The profile opens a mortgage planner and also retains its regular **Monthly budget** workspace. Fill in the start date, outstanding principal and balance date, fixed annual interest rate, and either the monthly principal-and-interest payment or remaining term. Taxes and insurance are kept separate from the loan payment.

After **Save plan**, mortgage details are locked against accidental changes, including when reopening the profile. **Edit details** unlocks the loan fields; saving locks them again. **Cancel changes** restores the last saved loan details while keeping any extra-payment and monthly escrow inputs. Monthly extras, one-time payments, and monthly escrow stay editable while the loan details are locked. Calculating a preview or a failed save does not lock unfinished edits.

Use monthly extras and the **One-time payments** section to compare interest saved and payoff dates. Add multiple full-date/amount entries, edit them inline, or remove entries. Include only payments after the balance snapshot that are not already reflected in it. The monthly model applies each entry on the next scheduled due date; both the entered date and modeled date are shown. Payments are capped at the principal remaining and marked when they cannot be applied after payoff. The impact panel shows principal paid down, interest and months saved by one-time payments beyond monthly extras, the new payoff date, and the balance after each entry. The interest rate stays unchanged.

**Calculate** previews your inputs; **Save plan** stores them and updates the workbook. Changed inputs clear outdated results until recalculated. Download is enabled only when the current inputs match the saved plan. The chart and payment table show the standard and accelerated schedules. Older month-only payments retain their amount and are converted to their original scheduled payment date. Restart the backend when upgrading; the UI disables plan saving if the running backend does not support dated entries.

The **Home improvements & expansion** section tracks dated project expenses independently of the loan, with editing, removal, year filtering, and totals. These expenses are not automatically financed or copied into the regular budget ledger.

Use **Monthly mortgage overview** to review payments and enter escrow from a statement. Pick a year and quarter (or **Full year**), then select an escrow amount to open its inline editor. **Done** closes the editor while keeping the draft; use **Save plan & escrow** to persist it. The **Balance** column shows principal remaining after each payment and any extras. **Yearly totals** opens annual projections within the same compact section; select a year to see its monthly details. This replaces the separate Payment by payment section. Changes carry forward by default, including into future years. Choose **This month only** for a temporary adjustment; the previous ongoing amount resumes the following month. Reset restores the prior carried amount or loan default. Zero is supported. **Calculate** updates the preview; **Save plan & escrow** saves all plan inputs and refreshes Excel. The monthly table, annual summaries, and year-by-year totals include escrow alongside principal, interest, and extra principal. These totals cover projected payments after the balance snapshot through payoff; escrow does not change interest savings or payoff dates, and taxes/insurance may continue afterward. This editor works while mortgage details are locked. Restart the updated Java backend if a capability notice appears.

Each mortgage profile saves its plan in its own `mortgage.xml` and creates `<profile name>-mortgage.xlsx` with the overview, both schedules, a dated one-time payment log, monthly housing payments, yearly housing totals, escrow changes, and improvement expenses. Keep the entire backend data directory when moving the app. Excel remains an export.

The current calculator supports fixed rates and monthly payments, with annual-rate/12 or Canadian semiannual interest conventions. Read **How this estimate works** for timing and exclusions. It forecasts from a balance immediately after a regular monthly payment and does not infer past interest. Rate changes, lender fees, prepayment penalties, and financed renovations are outside this version.

Reload Maven and restart the updated Java backend, then refresh the frontend to enable the new template endpoints. Existing budget profiles and their saved transactions are retained.

### Configurable budget categories

Use **Budget performance → Manage categories** to add categories, rename them, choose colors, or remove and restore them. Click **Save categories** to apply the configuration to every month and year of the selected profile. Other profiles keep their own configuration.

New categories start with a zero budget; use **Edit budgets** to set their monthly limits. They are also available when adding expenses, in search, charts, and the Excel workbook. Removed categories are excluded from new expenses. Existing transactions and budget amounts remain in totals and appear as **Removed · history kept** when that month has history; restore the category to use it again.

Requires the matching updated backend. Restart the Java app after updating it, then refresh the frontend. Category names support 1–40 characters; a profile supports up to 200 categories including removed entries.

### Savings and repeating budgets

**Budget performance** shows income not assigned to category budgets as **Savings**. The budget editor previews this amount as you change allocations. If allocations exceed recorded income, Savings is zero and the shortfall is shown. This planning figure is separate from actual income minus expenses and does not move money or add a transaction.

Save a monthly budget once and it repeats into following months, including across years, until a month has its own saved plan. Carried months show their source. Editing and saving one creates an override; saved zero budgets are also respected. Income and transactions are never copied. Use the matching updated Java backend for persistence and Excel exports.

## Home sale estimate

After saving a mortgage, the compact **Home sale estimate** card appears below the loan form. Enter a selling price for a live cash estimate, then choose **Save estimate** (or press Enter). **Costs & taxes** opens a popup on desktop and a full-screen editor on phones; **Use estimate** saves and closes it. Cancel and Escape discard only changes inside the editor.

Choose a closing date, enter an optional lender payoff quote, and set agent fees, other closing costs, buyer credits, and other secured loans. Costs start at zero until entered. The default payoff uses the saved mortgage schedule through closing; unsaved mortgage changes are not used. Optional tax reserves are entered manually; this feature does not calculate capital-gains taxes. A negative result is shown as an amount needed.

Estimates are isolated by profile, persist in mortgage XML, and export to a **Home sale estimate** sheet in that profile’s mortgage workbook. Restart the updated Java backend and refresh the frontend to enable the feature. A closing date older than a new balance snapshot must be updated before the estimate can be shown again.

## Appearance

Use the sun/moon button in the top bar to switch between light and dark themes. On first use, Hisabo follows the device theme. An explicit choice is remembered in this browser across reloads and profiles, and synchronized between open Hisabo tabs. It is applied before the app loads to prevent a bright flash. Theme preferences do not change mortgage or budget data; if browser storage is unavailable, the switch still works for the current session. Charts, dialogs, tables, and form controls follow the selected theme.
