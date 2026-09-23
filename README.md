# SCAMSCAN — MERN Capstone Website

SCAMSCAN is a safe, full-stack capstone website with real user accounts and two role-based modules:

- **ScamScan Detector:** a user checker for English, Tagalog, Taglish, and Filipino slang.
- **CyberShield:** an administrator-only dashboard for simulated small-business login, file, network, and user-behavior events.

It uses React + JSX and HTML through Vite for the frontend, Express for the API, and MongoDB/Mongoose for storage. Passwords are BCrypt-hashed; sessions are held in HTTP-only cookies; registration and reset codes are hashed and expire after 10 minutes. The detector is an explainable rule-based educational tool, not a trained AI model or proof that a link is safe. CyberShield uses simulated events only and does not scan real devices or networks.

## Included proposal features

| Proposal requirement | Where it is implemented |
| --- | --- |
| English, Tagalog, Taglish, and slang scam checking | `server/src/services/scamScorer.js` |
| Urgency, money request, OTP, URL, impersonation, and social-engineering signals | Scam scoring rules and the checker result screen |
| Scam risk bands: Safe, Warning, High, Scam | Scam scorer and analytics dashboard |
| Plain-language result and recommendation | Scam checker result card |
| Total checks, scam/safe split, scam traits, language analytics | Scam analytics page |
| Login tracking: IP, time, device, location, attempts | Simulated-event form and `SecurityEvent` model |
| File, network, and user-behavior monitoring | Simulated-event form, threat scorer, CyberShield dashboard |
| User baseline: usual device, time, and file volume | Automatically derived after three saved events for one actor |
| Threat weights and Low/Medium/High/Critical ranges | `server/src/services/threatScorer.js` |
| Live high-risk alert feed and response | CyberShield dashboard: acknowledge or resolve a simulated alert |
| Threats/day, attack type, highest-risk users, file activity | CyberShield dashboard charts |
| Registration, login, logout, reset password | Pending registration OTP, MongoDB `users` collection, `/api/auth` endpoints, three-attempt login lock |
| User vs. admin permissions | User history is private; analytics/CyberShield/user management require admin role |
| Profile and settings | User name and notification preferences are updated in MongoDB |
| Help, recovery guide, and About Us | Professional in-app support and product pages |
| Guest mode | A private temporary MongoDB user named Guest is created per browser session |
| Image scan | Browser OCR extracts screenshot text before ScamScan analyzes and saves it |
| Rule-based foundation with a future ML path | Explainable MVP below; upgrade plan in Step 10 |

## Architecture

```text
React + Vite browser UI
        │ fetch / JSON
        ▼
Express API ── scoring services ── MongoDB
  /scam                         MessageAnalysis collection
  /threats                      SecurityEvent collection
```

## MERN and CRUD checklist

Yes—SCAMSCAN is a **MERN** application:

- **MongoDB:** users, password-reset hashes, preferences, saved scam checks, and simulated security events.
- **Express:** secured REST API endpoints.
- **React:** JSX frontend, landing page, scanner, member pages, and admin console.
- **Node.js:** runs the API, authentication, scoring, and database integration.

It also has complete CRUD workflows:

| Data | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| User accounts | Verify registration OTP / admin bootstrap | Profile and admin list | Name, preferences, password, role, active status | Admin can delete a user (not self) |
| Saved scans | Run a scan | Filtered, paged history / admin reports | Admin can review score, level, explanation, and recommendation; audit records the edit | Owner can delete their own scan |
| Support requests | Member sends request | Member history / admin inbox | Admin can reply and change status | Retained with account until admin deletes it |
| Security events | Admin simulation | CyberShield dashboard | Acknowledge or resolve alerts | Deleting an admin-submitted account removes its associated simulated events |

The administrator has a separate control center with report review, help replies, system analysis, audit logs, CyberShield, simulated-event tools, account management, and their own profile/settings. Guest accounts are excluded from the member directory; guest scan reports remain visible to administrators.

Guest visitors can choose **Continue as Guest** from the landing page or sign-in page. ScamScan creates an isolated guest account named Guest, so guest scan history is not shared with other visitors. Guest accounts do not receive profile/password settings.

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

5. **Set your MongoDB connection string and session secret** in `server/.env`.

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

   Registration in the website always creates a normal `user` account. Only this controlled command can create or promote the initial `admin` account.

7. **Start both applications.**

   ```powershell
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:5000/api/health](http://localhost:5000/api/health).

8. **Create a normal user account.** Open [http://localhost:5173](http://localhost:5173), select **Create account**, and request the six-digit email code. The user record is created after the code is verified. Passwords must have 8–128 characters, a letter, a number, and no spaces. Without SMTP configured, development mode displays the code in the UI. Sign in as the administrator account to access the control center.

9. **Demo ScamScan Detector.** As a signed-in user, select **Use an example**, then **Check risk**. The app saves the assessment in MongoDB, shows the score, classification, language, signals, and recommendation, and clears the input for the next check. Scan History has risk tabs and page controls.

10. **Demo CyberShield.** Sign in as an administrator and select **Load safe demo data** in the sidebar. It inserts synthetic events only. Open **CyberShield** to see the severity, threat type, user, file-activity charts, high-risk alert feed, and acknowledge/resolve actions.

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
| `POST` | `/api/threats/events` | Score and save a synthetic security event |
| `POST` | `/api/threats/demo-seed` | Insert safe demonstration events |
| `GET` | `/api/threats/dashboard` | CyberShield metrics, charts, and alerts |
| `POST` | `/api/auth/register` | Stage a registration and send an email OTP |
| `POST` | `/api/auth/verify-email` | Verify OTP and create the user account |
| `POST` | `/api/auth/login` | Create secure browser session |
| `POST` | `/api/auth/forgot-password` | Request a 10-minute reset code |
| `POST` | `/api/auth/reset-password` | Set a new password with a valid code |
| `GET` | `/api/admin/users` | Administrator-only account list |
| `PATCH` | `/api/admin/reports/:id` | Human review of a saved report |
| `POST` | `/api/admin/support/:id/reply` | Reply to a member's help request |

## Suggested capstone build sequence

1. **Week 1 — requirements:** Define the problem, intended users, research questions, limitations, ethics statement, user stories, and test criteria.
2. **Week 2 — database/API:** Draw the two MongoDB schemas, run the API and MongoDB, and verify every endpoint with Postman or Bruno.
3. **Week 3 — frontend:** Finish the responsive checker, dashboard, empty states, error states, and accessibility labels.
4. **Week 4 — detection evaluation:** Create a small de-identified test dataset. Record expected and actual classifications. Do not use real OTPs, banking data, private messages, malware, or unauthorized network traffic.
5. **Week 5 — evidence:** Run usability tests, capture screenshots, and calculate confusion matrix, precision, recall, and F1 for the scam detector. For CyberShield, measure alert accuracy against your scripted synthetic scenarios.
6. **Week 6 — presentation:** Demonstrate one scam message and one simulated security incident; show the explanation and analytics; explain data privacy, false positives, and future ML improvements.

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
