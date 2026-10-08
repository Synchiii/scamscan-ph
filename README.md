# SCAMSCAN — MERN Capstone Website

SCAMSCAN is a safe, full-stack capstone website with real user accounts and an explainable scam-risk detector:

- **ScamScan Detector:** a user checker for English, Tagalog, Taglish, and Filipino slang.

It uses React + JSX and HTML through Vite for the frontend, Express for the API, and MongoDB/Mongoose for storage. Passwords are BCrypt-hashed; JWT sessions are held in HTTP-only cookies and expire after 30 minutes by default; registration and reset codes are hashed and expire after 10 minutes. The detector is an explainable rule-based educational tool, not a trained AI model or proof that a link is safe.

## Included proposal features

| Proposal requirement | Where it is implemented |
| --- | --- |
| English, Tagalog, Taglish, and slang scam checking | `server/src/services/scamScorer.js` |
| Urgency, money request, OTP, URL, impersonation, and social-engineering signals | Scam scoring rules and the checker result screen |
| Scam risk bands: Safe, Warning, High, Scam | Scam scorer and analytics dashboard |
| Plain-language result and recommendation | Scam checker result card |
| Total checks, scam/safe split, scam traits, language analytics | Scam analytics page |
| Registration, login, logout, reset password | Pending registration OTP, MongoDB `users` collection, `/api/auth` endpoints, three-attempt login lock |
| User, Staff, and Admin permissions | Users have private scans and support; Staff manage regular users, content, and support; Admin control roles and maintenance |
| Profile and settings | User name and notification preferences are updated in MongoDB |
| Help, recovery guide, and About Us | Professional in-app support and informational pages |
| User-to-Staff chat | Floating popup, private messages and media in MongoDB/GridFS, automatic refresh, Staff inbox, Admin oversight |
| Member overview and report history | Large circular Detector shortcut, sidebar navigation, fixed table with ten reports per page |
| Staff workspace | A separate dashboard for user management, content CRUD, and customer support |
| Maintenance mode | Admin-controlled, persisted in MongoDB, enforced on the API and shown in the UI |
| Image scan | Browser OCR extracts screenshot text before ScamScan analyzes and saves it |
| Rule-based foundation with a future ML path | Explainable MVP below; upgrade plan in Step 10 |

## Architecture

```text
React + Vite browser UI
        │ fetch / JSON
        ▼
Express API ── scoring services ── MongoDB
  /scam                         MessageAnalysis collection
```

## MERN and CRUD checklist

Yes—SCAMSCAN is a **MERN** application:

- **MongoDB:** users, password-reset hashes, preferences, and saved scam checks.
- **Express:** secured REST API endpoints.
- **React:** JSX frontend, landing page, scanner, member pages, and admin console.
- **Node.js:** runs the API, authentication, scoring, and database integration.

It also has complete CRUD workflows:

| Data | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| User accounts | Verify registration OTP / admin bootstrap | Profile and admin list | Name, preferences, password, role, active status | Admin can delete a user (not self) |
| Saved scans | Run a scan | Filtered, paged history / admin reports | Admin can review score, level, explanation, and recommendation; audit records the edit | Owner can delete their own scan |
| Support requests | Member sends request | Member history / admin inbox | Admin can reply and change status | Retained with account until admin deletes it |

The administrator has a separate control center with report review, help replies, system analysis, audit logs, account management, content, maintenance, and profile/settings. Guest access has been removed. Existing guest records are excluded from authentication and account management without deleting historical database data.

## User roles and operations

| Role | Access |
| --- | --- |
| User | Verified account, detector, private history, support, profile and settings |
| Staff | Regular-user account management, content publishing, support replies, own profile/settings |
| Admin | All management features plus role management, report review, analytics, audit log, and maintenance mode |

To create Staff access, register and verify an ordinary account, then sign in as Admin, open **Accounts → Edit details**, select **Staff**, and save. The Staff member signs in with their own email and password. Public registration always creates a regular User; Staff cannot promote themselves or edit Staff/Admin accounts.

**Manage Content** creates guides, news, and announcements. Drafts stay private; published entries appear on the landing page and user overview.

**Staff and Admin layouts:** Both workspaces use a compact, grouped sidebar that stays in place on desktop and becomes a horizontally scrollable navigation strip on smaller screens. Large page introductions remain hidden; functional card labels and accessible page headings remain. Staff get member/content/request totals and direct shortcuts. Admin get account/report/request totals, recent activity and system tools. Long lists scroll inside stable-height panels instead of stretching the entire dashboard.

**Accounts** has name/email search, status filters, Admin-only role filters, ten rows per page and one account editor at a time. Record, edit, suspend/activate and delete actions retain their API permissions; self-suspension, self-deletion and changing your own Admin role are disabled in the UI as well as protected by the API. Full account records separate recent reports and requests into paged sections, with audit records available only to Admin.

**Help inbox** uses a request list and a single reading/reply pane. Search or filter by status, choose a request, reply, or change its status without working through a long stack of forms. **Content management** separates the editor from a searchable, filtered library with five entries per page. **Report review** and **Audit log** use fixed-column tables with twenty rows per page and contained scrolling. Audit filtering covers the latest 250 events supplied by the existing API. The maintenance page separates saved mode, editable controls and a visitor-message preview; changes are applied only after saving. System Analysis uses saved scam checks and clearly identifies rule-based results.

**Chat with Staff:** Click the **Chat** bubble in the bottom-right corner of any signed-in page. Sidebar and overview chat shortcuts open the same popup without leaving the page. Members talk to the shared Staff/Admin support team; staff choose a member from their inbox. Minimize or press Escape to close the popup without losing its draft. Signing out unmounts it and clears account-specific chat state. Messages refresh every 10 seconds and the inbox every 30 seconds while the popup and browser tab are visible. Earlier messages can be loaded without refreshing the page. The displayed staff directory lists team members, not live online presence.

Use the **paperclip** to select up to three attachments per message, with or without a text caption. Images (PNG/JPG/WEBP/GIF) are limited to **5 MB**, videos (MP4/WEBM) to **25 MB**, and audio (MP3/WAV), PDF and TXT files to **10 MB** each. Images preview inline; videos/audio have playback controls; all files can be downloaded. The API checks size, extension and content signatures, limits uploads to six per minute per account/IP, and only accepts the sender's pending files from that conversation. HTML, SVG, executables and arbitrary file formats are not accepted. These checks are not antivirus scanning: do not open untrusted downloads.

Messages and conversations are stored in `chatmessages` and `chatthreads`; attachment bytes are stored privately in MongoDB GridFS (`chat_uploads.files` / `chat_uploads.chunks`) using the existing database connection. No public uploads folder, extra package or MongoDB migration is needed. Reading or streaming a sent attachment requires an authenticated conversation owner or authorized Staff/Admin; video seeking supports byte ranges. Unsent uploads older than 24 hours are cleaned up when that sender next uploads. Account deletion also removes that account's conversation files. Messages are limited to 2,000 characters and 15 sends per minute per account/IP. Do not share credentials or payment details. Chat is not an emergency service.

**Detector, Recovery Guide and Profile:** The detector uses separate stable input/result cards with Message, Link and Image modes. Successful scans are still saved and clear their input. **Recovery Guide** places **Private request** and **Your requests** at the top, with replies inside expandable requests and short recovery guides below. New requests appear immediately after submission. **Profile** adds an identity card and security summary while preserving name updates and the Settings shortcut. These layouts stack on smaller screens and respect reduced-motion preferences.

**Scan History** uses a fixed-column table with ten row slots and ten reports per page. An eleventh report creates another page; use **Previous / Next** to navigate. Risk filters reset to page one, and deleting the last report on a page returns to the last available page. The upper duplicate navigation tabs have been removed; the sidebar remains available on desktop and mobile.

**Maintenance Mode** is available only to Admin. Enable it and save a public message to pause visitors, User, and Staff access. Admin login, password recovery, and maintenance controls remain available. Existing screens check maintenance every 30 seconds and on focus; API enforcement is immediate. Disable maintenance to reopen the app.

JWT sessions expire after **30 minutes** by default for members, staff, and admins, including sessions left idle. Use `SESSION_TTL_HOURS=0.5` in `server/.env`, restart the API, and sign in again. The maximum session duration is 30 minutes; older longer settings fall back to this limit. This is measured from sign-in, not the last interaction. The browser returns to Login when the deadline arrives, on resume/focus after expiration, or when an authenticated API call returns 401. Role changes invalidate the old session; sign in again to use the new role.

## Step-by-step: run it locally

1. **Install prerequisites.** Install Node.js 20+ and either MongoDB Community Server or create a free MongoDB Atlas cluster. You will also need a code editor such as VS Code.

2. **Open this project folder in a terminal.**

   ```powershell
   cd "C:\Users\jorda\Documents\Codex\2026-09-21\help-x20\outputs\sentinel-ph"
   ```

3. **Install JavaScript packages.**

   ```powershell
   npm install
   ```

4. **Create the backend environment file.** Copy `server/.env.example` to `server/.env`. In PowerShell:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

5. **Set your MongoDB connection string and session secret** in `server/.env`. `SESSION_TTL_HOURS=0.5` sets a 30-minute login session; after it expires, the app signs the user out and returns them to the login screen.

   For a local MongoDB server, leave:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/sentinel_ph
   PORT=5000
   CLIENT_ORIGIN=http://localhost:5173
   ```

   For MongoDB Atlas, replace only `MONGODB_URI` with the connection string from Atlas. Never commit this file or share its password.

   Generate a long `JWT_SECRET` with this command, then paste the output into `server/.env`:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

6. **Create the first administrator.** Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `server/.env`, then run:

   ```powershell
   npm run create-admin
   ```

   Registration in the website always creates a normal `user` account. Use this controlled command to create the initial `admin` account. Administrators can then assign Staff or Admin roles in the account-management screen.

   To change only an existing account password without changing its role, run:

   ```powershell
   npm run reset-password
   ```

7. **Start both applications.**

   ```powershell
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:5000/api/health](http://localhost:5000/api/health).

8. **Create a normal user account.** Open [http://localhost:5173](http://localhost:5173), select **Create account**, and request the six-digit email code. The user record is created after the code is verified. Passwords must have 8–128 characters and no spaces. Without SMTP configured, development mode displays the code in the UI. Sign in as the administrator account to access the control center.

9. **Demo ScamScan Detector.** As a signed-in user, select **Try an example**, then **Check risk**. The app saves the assessment in MongoDB, shows the score, classification, signals, and recommendation, and clears the input for the next check. The full saved report also shows language. Scan History has risk tabs and page controls.

11. **Test password reset.** On the sign-in screen choose **Forgot password**. Development mode displays a six-digit code when SMTP is not configured. Production requires `SMTP_*` and `EMAIL_FROM` so the code is delivered by email.

12. **Run the scoring tests.**

   ```powershell
   npm test
   ```

13. **Upgrade the AI for your final evaluation.** The supplied MVP uses transparent NLP-style rules, which makes early testing and presentations reliable. To claim a trained ML model, do this only after collecting consented, de-identified data:

   1. Prepare labelled message data (`safe`, `scam`) with English/Tagalog/Taglish examples.
   2. Split it into train, validation, and test sets without duplicates across sets.
   3. Train a baseline such as TF-IDF + Logistic Regression, compare precision, recall, F1, and false-positive rate, then save the model.
   4. Expose a separate Python inference service or call it from `scamScorer.js`; retain rule flags as explanations and a fallback.
   5. Document limitations, bias checks by language, data consent, and that no classifier is definitive proof of fraud.

## Key API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/scam/analyze` | Score and save `{ "message": "..." }` |
| `GET` | `/api/scam/history?page=1&level=High` | Current user's filtered, paged checks |
| `GET` | `/api/scam/analytics` | Research/admin aggregate data |
| `POST` | `/api/auth/register` | Stage a registration and send an email OTP |
| `POST` | `/api/auth/verify-email` | Verify OTP and create the user account |
| `POST` | `/api/auth/login` | Create secure browser session |
| `POST` | `/api/auth/forgot-password` | Request a 10-minute reset code |
| `POST` | `/api/auth/reset-password` | Set a new password with a valid code |
| `GET` | `/api/admin/users` | Admin account directory / Staff regular-user directory |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/management/content` | Staff/Admin content CRUD (append record ID for edits/deletes) |
| `GET` / `PATCH` | `/api/admin/maintenance` | Admin maintenance settings |
| `GET` | `/api/site/status` | Public maintenance status |
| `PATCH` | `/api/admin/reports/:id` | Human review of a saved report |
| `POST` | `/api/admin/support/:id/reply` | Reply to a member's help request |

## Suggested capstone build sequence

1. **Week 1 — requirements:** Define the problem, intended users, research questions, limitations, ethics statement, user stories, and test criteria.
2. **Week 2 — database/API:** Draw the two MongoDB schemas, run the API and MongoDB, and verify every endpoint with Postman or Bruno.
3. **Week 3 — frontend:** Finish the responsive checker, dashboard, empty states, error states, and accessibility labels.
4. **Week 4 — detection evaluation:** Create a small de-identified test dataset. Record expected and actual classifications. Do not use real OTPs, banking data, private messages, malware, or unauthorized network traffic.
5. **Week 5 — evidence:** Run usability tests, capture screenshots, and calculate confusion matrix, precision, recall, and F1 for the scam detector.
6. **Week 6 — presentation:** Demonstrate scam-message and suspicious-link checks; show the explanation and analytics; explain data privacy, false positives, and future ML improvements.

## Before deployment

- Review and tune API rate limiting, audit retention, and security headers for the deployed host.
- Keep environment variables in the host dashboard, never in Git.
- Restrict CORS to your deployed frontend URL.
- Add privacy notice, retention period, consent process, and deletion workflow.
- Validate any external URL without opening it automatically. Never turn the checker into a link-clicking service.

## Project map

```text
client/                 React JSX application
  src/App.jsx           screens, forms, analytics, dashboard
  src/api.js            API client
  src/styles.css        responsive visual design
server/                 Express + MongoDB API
  src/models/           MongoDB schemas
  src/services/         explainable scam and threat scoring
  src/routes/           REST endpoints
  test/                 scorer unit tests
```
