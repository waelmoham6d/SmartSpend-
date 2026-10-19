# SmartSpend AI

A small, polished, Arabic-friendly expense tracker built with Flutter for a
university Mobile Application Development course.

The project has two clear parts:

1. **A reliable local expense tracker** — transactions, categories, filters,
   monthly totals, a spending chart, and deterministic monthly insights stored
   in SQLite.
2. **One meaningful AI feature** — an AI Quick Add box that turns a natural
   sentence (Egyptian Arabic or English) into a structured transaction, shown
   in an editable confirmation screen before anything is saved.

The AI never calculates totals. Every financial number in the app comes from
local, deterministic Dart code over the SQLite rows. The LLM is only used for
language extraction and optional wording.

> **Status:** the source code, database layer, tests, Node proxy, and Android
> scaffolding are complete in this repository, but Flutter/Dart/Android SDK were
> **not installed** on the machine where it was written. Nothing here has been
> compiled, analyzed, or tested with Flutter yet. See
> [What still needs verification](#what-still-needs-verification).

---

## Contents

- [Features](#features)
- [What is deliberately out of scope](#what-is-deliberately-out-of-scope)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [AI flow and safety rules](#ai-flow-and-safety-rules)
- [Security and privacy](#security-and-privacy)
- [Free tier, quotas, and graceful degradation](#free-tier-quotas-and-graceful-degradation)
- [Setup](#setup)
- [Configure the AI proxy](#configure-the-ai-proxy)
- [Exact commands](#exact-commands)
- [Testing](#testing)
- [University demo script](#university-demo-script)
- [Troubleshooting](#troubleshooting)
- [What still needs verification](#what-still-needs-verification)

---

## Features

### Core tracker

- Dashboard with total balance, current-month income, and current-month expenses.
- Simple 6-month spending bar chart (`fl_chart`).
- Add, edit, and delete income/expense transactions.
- Every transaction has amount, type, category, date, and description.
- Transaction history grouped by day.
- Filters by type, category, and date range.
- Swipe to delete, tap to edit.
- Summary of the filtered income/expenses.
- Empty, loading, and error states.
- EGP currency formatting.
- Local persistence with `sqflite` (survives app restarts).
- Sample/demo data loader for presentations.

### AI Quick Add

- Natural text input in Egyptian Arabic or English.
- Structured extraction of amount, type, category, date, and description.
- Editable confirmation screen before saving.
- Missing or invalid fields are clearly flagged instead of invented.
- Safe handling for missing config, network errors, timeouts, bad JSON, and
  quota exhaustion.
- Manual add always remains available.

### Spending insights

- Current month vs previous month comparison.
- Largest spending category with its share of monthly expenses.
- Category breakdown with progress bars.
- A deterministic, locally calculated summary.
- Optional AI-written explanation of the already-calculated numbers.
- Falls back to the deterministic summary whenever the AI is unavailable.

### UI

- Material 3.
- Arabic-first RTL interface with an English toggle.
- Light and dark themes.
- Consistent cards, icons, colors, and spacing.
- Reusable widgets: `AppCard`, `TransactionTile`, `EmptyState`, `InfoBanner`,
  `SpendingChart`, and more.

---

## What is deliberately out of scope

To keep the project medium-difficulty and explainable, these were **not**
implemented:

- Voice input or speech recognition.
- OCR or receipt scanning.
- RAG, embeddings, or vector databases.
- Multi-agent systems.
- Authentication, accounts, or cloud sync.
- Notifications or push messaging.
- Complex budget enforcement.
- A chatbot screen.

The app is single-user and stores data locally.

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                         Flutter app                          │
│                                                              │
│  Screens (Dashboard, Transactions, AI Quick Add, Insights)   │
│        │                                                     │
│        ▼                                                     │
│  FinanceController  (ChangeNotifier, provider)               │
│        │                                                     │
│        ├── FinanceCalculator   (pure Dart, all money math)   │
│        │                                                     │
│        ▼                                                     │
│  TransactionRepository ──► AppDatabase (sqflite / SQLite)    │
│                                                              │
│  AiService ──► HTTP ──► Node proxy ──► Gemini API            │
└──────────────────────────────────────────────────────────────┘
```

- `FinanceCalculator` is pure and unit-tested. The LLM never touches it.
- `AiService` only knows the proxy URL. It never contains an API key.
- The proxy owns the key and adds a small rate limit and input validation.

### Why a tiny proxy instead of calling the LLM directly from Flutter?

A key embedded in a Flutter app can be extracted from the APK. The proxy keeps
the key server-side and is the simplest secure option for a course project.
It is a few hundred lines of dependency-free Node code. If you deploy it with HTTPS
you can use the same app without changing the Flutter code.

### Why no embeddings/RAG?

There is no semantic-search or free-text-retrieval requirement. Every question
the app asks is answered by deterministic aggregation over a handful of rows, so
embeddings would only add cost and complexity.

---

## Project structure

```text
SmartSpend/
├─ lib/
│  ├─ main.dart                       # providers + app entry point
│  ├─ app.dart                        # MaterialApp, localization, themes
│  ├─ config/app_config.dart          # AI proxy URL and timeouts
│  ├─ core/
│  │  ├─ app_colors.dart
│  │  ├─ app_settings.dart            # Arabic/English toggle
│  │  ├─ app_strings.dart             # all UI strings + formatting
│  │  ├─ app_theme.dart
│  │  └─ category_style.dart
│  ├─ models/
│  │  ├─ ai_extraction.dart           # validated LLM result
│  │  ├─ finance_summary.dart
│  │  ├─ spend_category.dart
│  │  ├─ transaction_record.dart
│  │  └─ transaction_type.dart
│  ├─ data/
│  │  ├─ app_database.dart            # SQLite schema and creation
│  │  ├─ demo_transactions.dart       # sample data
│  │  └─ transaction_repository.dart  # CRUD
│  ├─ services/ai_service.dart        # HTTP client for the proxy
│  ├─ state/finance_controller.dart   # ChangeNotifier state
│  ├─ utils/finance_calculator.dart   # all deterministic money math
│  ├─ widgets/                        # reusable UI
│  └─ screens/
│     ├─ home_shell.dart
│     ├─ dashboard/dashboard_screen.dart
│     ├─ transactions/
│     │  ├─ transaction_form_screen.dart
│     │  └─ transactions_screen.dart
│     ├─ ai/ai_quick_add_screen.dart
│     └─ insights/insights_screen.dart
├─ server/
│  ├─ server.js                       # Node proxy (no dependencies)
│  ├─ package.json
│  └─ .env.example
├─ test/
│  ├─ finance_calculator_test.dart
│  └─ ai_extraction_test.dart
├─ android/                           # standard Android embedding
├─ pubspec.yaml
├─ analysis_options.yaml
└─ .gitignore
```

---

## Data model

One SQLite table, `transactions`:

| Column         | Type    | Notes                                    |
| -------------- | ------- | ---------------------------------------- |
| `id`           | INTEGER | primary key, autoincrement               |
| `amount_cents` | INTEGER | positive amount in cents (no float math) |
| `type`         | TEXT    | `expense` or `income`                    |
| `category`     | TEXT    | category id, for example `food`          |
| `date`         | TEXT    | `YYYY-MM-DD`, used for filtering         |
| `description`  | TEXT    | short user description                   |
| `created_at`   | INTEGER | milliseconds since epoch                 |

Amounts are stored as integer cents so totals never suffer from floating-point
rounding. Indexes exist on `date` and `type`.

Categories are a fixed enum shared by the app and the proxy schema:

`food`, `transport`, `shopping`, `bills`, `health`, `education`,
`entertainment`, `rent`, `salary`, `freelance`, `gift`, `other`.

Expense categories and income categories are filtered in the form, and `other`
works for both.

---

## AI flow and safety rules

### Extraction

1. The user types something like:
   `صرفت 150 جنيه بنزين امبارح.`
2. `AiService.extractTransaction` sends only that text to the proxy.
3. The proxy asks Gemini for JSON using a strict response schema and passes
   today's date in `Africa/Cairo` so "امبارح" resolves correctly.
4. The proxy normalizes the output: invalid values become empty/zero instead of
   being trusted.
5. `AiExtraction` parses tolerantly. Missing or invalid fields are collected in
   `missingFields`.
6. The confirmation screen opens with the extracted values prefilled and a
   warning listing the missing fields.
7. Nothing is saved until the user taps **Save transaction** on that form.

### Money math

- Balance, monthly totals, the chart, category breakdown, and comparisons are all
  computed by `FinanceCalculator` from SQLite rows.
- The AI explanation endpoint receives already-calculated facts and is told to
  use only those numbers and never to calculate.
- The deterministic summary is always displayed, even when an AI explanation is
  shown, so the source of truth is obvious.

### Failure handling

| Situation                | Behaviour                                                   |
| ------------------------ | ----------------------------------------------------------- |
| Proxy not configured     | AI screen shows setup instructions; manual add still works  |
| Network / proxy down     | Localized error + retry; deterministic insights still work  |
| Timeout                  | Localized error + retry                                     |
| Invalid model JSON       | Rejected; localized "unclear response" message              |
| Missing fields           | Form opens with warnings; user completes them               |
| Free quota exhausted     | Localized quota message; manual add still works             |
| Invalid/unknown category | Treated as missing, never silently invented                 |

---

## Security and privacy

- **No API key in the Flutter app.** The app only knows `AI_PROXY_URL`.
- **No secret in Git.** `.env` is ignored; only `server/.env.example` with
  placeholders is committed.
- **The proxy owns the key** and reads it from the environment.
- **Input validation** on the proxy: text length, JSON shape, allowed categories,
  and a per-IP rate limit protect the free quota.
- **Prompt-injection guard:** the user text is treated as untrusted data in the
  system prompt, not as instructions.
- **Privacy:** the AI screen sends the sentence to the configured proxy. No
  transaction rows are sent for extraction, and only aggregated facts are sent
  for explanations. This is stated in the app UI.
- **Cleartext HTTP** is enabled in the Android manifest for local development
  against `http://10.0.2.2:8787`. Use an HTTPS proxy URL for anything real.
- The app has no login and stores data only on the device.

---

## Free tier, quotas, and graceful degradation

- The proxy is designed around a free-tier LLM key. The default model is
  `gemini-2.5-flash`, configured through `GEMINI_MODEL`; check your provider's
  current free limits because they change over time.
- The proxy returns a clear `quota_exceeded` code for HTTP 429, and the app shows
  a localized message.
- The proxy also has its own `RATE_LIMIT_PER_MINUTE` (default 20) so a runaway
  demo cannot burn the whole quota.
- When the LLM is unavailable for any reason:
  - Transactions can still be created, edited, deleted, filtered, and charted.
  - Insights still show the deterministic, calculated summary.
  - Only the optional AI wording and AI extraction are disabled.

---

## Setup

### 1. Install the tools

- Flutter (a recent stable channel; this project targets Dart `>=3.4.0`).
- Android Studio or the Android command-line SDK.
- An Android emulator or a physical Android phone.

```powershell
flutter --version
flutter doctor
```

Install the dependencies:

```powershell
flutter pub get
```

### 2. If the Android folder needs regenerating

The `android/` folder in this repository is a standard Flutter Android
embedding, but it was written without an SDK to test it. If Gradle or plugin
versions complain, let Flutter refresh the platform folder:

```powershell
flutter create . --platforms=android --project-name smartspend
```

Review the regenerated files before committing. Your `lib/`, `test/`, and
`server/` folders are the project's real work; the platform folder is
scaffolding.

---

## Configure the AI proxy

The app works without the proxy, but AI Quick Add and AI explanations need it.

### 1. Get a key

Create a free API key in Google AI Studio (or use any provider you prefer).

### 2. Create the environment file

```powershell
cd server
Copy-Item .env.example .env
notepad .env
```

Set at least:

```text
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-2.5-flash
PORT=8787
```

`server/.env` is ignored by Git.

### 3. Start the proxy

With Node 20.6 or newer:

```powershell
cd server
node --env-file=.env server.js
```

With an older Node, set the variable for the current PowerShell session instead:

```powershell
$env:GEMINI_API_KEY="your_real_key"
$env:GEMINI_MODEL="gemini-2.5-flash"
node server.js
```

Check it:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8787/health
```

You want `"configured":true` in the response.

### 4. Point the app at the proxy

Android emulator (`10.0.2.2` is the emulator's alias for your computer):

```powershell
flutter run --dart-define=AI_PROXY_URL=http://10.0.2.2:8787
```

Physical phone on the same Wi-Fi (find your PC's IPv4 with `ipconfig`, and allow
port 8787 through the firewall if Windows asks):

```powershell
flutter run --dart-define=AI_PROXY_URL=http://192.168.1.23:8787
```

Hosted proxy (recommended for a real demo):

```powershell
flutter run --dart-define=AI_PROXY_URL=https://your-proxy.example.com
```

### Changing provider or model

- Change the model with `GEMINI_MODEL`; no Flutter change is needed.
- To use a different provider, replace the single `callGemini` function in
  `server/server.js` and keep the same request/response contract. The Flutter app
  only cares about `/api/extract` and `/api/explain`.

---

## Exact commands

Run these from the project root once Flutter is installed:

```powershell
# 1. Install packages
flutter pub get

# 2. Static analysis
flutter analyze
# If only style info messages appear, apply the safe fixes:
dart fix --apply

# 3. Unit tests (calculations and AI parsing)
flutter test

# 4. Run on an emulator or connected device
flutter run --dart-define=AI_PROXY_URL=http://10.0.2.2:8787

# 5. Debug APK for a presentation backup
flutter build apk --debug

# 6. Release APK (uses the debug signing key in this project)
flutter build apk --release --dart-define=AI_PROXY_URL=https://your-proxy.example.com
```

Proxy commands:

```powershell
cd server
node --check server.js
node --env-file=.env server.js
```

---

## Testing

Two pure unit-test files are included:

- `test/finance_calculator_test.dart`
  - balance and monthly totals
  - 6-month chart series
  - current vs previous month comparison
  - top category and shares
  - inclusive date filtering, type filtering, and category filtering
  - newest-first sorting
  - empty-data behaviour
- `test/ai_extraction_test.dart`
  - complete payload parsing
  - nested `transaction` payload
  - missing amount handling
  - invalid category handling
  - type inference from an unambiguous category
  - Arabic digits, Arabic keywords, and `dd/MM/yyyy` dates
  - mismatched category/type handling
  - description trimming and length cap

Run them with:

```powershell
flutter test
```

These tests exercise pure Dart code only, so they do not need an emulator.

---

## University demo script

A 4-minute demo that shows every requirement:

1. **Open the app (Arabic, RTL).** Point out the dashboard, EGP currency, and the
   language toggle.
2. **Tap "تحميل بيانات تجريبية"** on the empty dashboard, or add a transaction
   manually. Show the balance card and the 6-month chart.
3. **Go to Transactions.** Filter by a category and by a date range. Show the
   filtered totals. Swipe one row to delete (or open it and use the delete icon).
4. **Open a transaction and edit it.** Save and show the dashboard update.
5. **Go to "إضافة ذكية".** Type or tap:
   `صرفت 150 جنيه بنزين امبارح.`
   Press extract. Show the review banner in the confirmation form, change the
   category to prove it is editable, then save.
6. **Go to "تحليلات".** Show the current vs previous month card, the largest
   category, and the category breakdown. Tap **Explain with AI** to show the
   optional wording, and note that the calculated summary is always present.
7. **Stop the proxy and try AI again.** Show the graceful error while manual add
   and insights keep working. This is a strong reliability point.
8. **Toggle to English** to show the bilingual UI.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| AI button is disabled | `AI_PROXY_URL` was not passed. Use `--dart-define=AI_PROXY_URL=...`. |
| `Could not reach the AI service` on the emulator | Make sure the proxy is running and use `10.0.2.2`, not `localhost`. |
| Physical phone cannot connect | Same Wi-Fi, correct PC IPv4, Windows Firewall allows port 8787. |
| `not_configured` from the proxy | `GEMINI_API_KEY` is missing. Check `/health`. |
| `quota_exceeded` | The free quota or the proxy rate limit was hit. Wait a minute or use manual add. |
| Model returns an error | Confirm `GEMINI_MODEL` is a valid model for your key. |
| SQLite error on desktop | `sqflite` targets Android/iOS. Run the app on Android, or add `sqflite_common_ffi` if you want desktop support. |
| Gradle/AGP version error | Run `flutter create . --platforms=android --project-name smartspend` and retry. |

---

## What still needs verification

Written without Flutter, Dart, or the Android SDK installed. These items are
implemented but **not** verified yet:

- `flutter analyze` and `flutter test` have not been run.
- The app has never been compiled or launched.
- The `fl_chart` API usage in `lib/widgets/spending_chart.dart` targets the
  `0.70.x` line.
- `sqflite` persistence has not been exercised on a device.
- The Android Gradle setup (AGP 8.7.3, Kotlin 2.1.0, Gradle 8.9) has not been
  built. Regenerate with `flutter create` if versions conflict.
- Arabic RTL layout and Material 3 widgets have not been visually reviewed.
- The proxy was syntax-checked with `node --check` and its `/health` endpoint was
  exercised locally without a key; a real LLM call has not been made.
- The default Gemini model name may need updating depending on current provider
  availability.

No claim of successful compilation or passing tests is made.
