# Coaching Hub — coaching center management (MVP)

> "Google Classroom shares files. This runs your entire coaching center: exams, results, fees, and parents."

Next.js 16 (App Router) + Firebase (Auth + Firestore), deployed on Vercel.
The app name is a placeholder — change `NEXT_PUBLIC_APP_NAME` and it updates everywhere.

## What's built

| Who | Can do |
|---|---|
| **Admin / teacher** (email or Google login) | Dashboard · Batches · Students (+ Excel import) · Question bank (+ Excel upload, Bangla, KaTeX math) · Create exams (manual pick or one-click generator by chapter + difficulty mix) · Live merit list · Per-question insight (which wrong option students chose) · Print paper in sets A–D with OMR-style answer sheet and answer key · Attendance by tapping names · Fees with bKash/Nagad reference · Notices · SMS to guardians (fee reminders, absences, results, notices) · Staff invites (admin only) |
| **Student** (phone + OTP, no Gmail) | Timed MCQ exam with auto-submit, negative marking, per-student shuffled questions and options, tab-switch detection, progress saved on the device · Instant score · Solutions, explanations and rank after the exam closes · Weak chapters · Attendance, fee status, notices |
| **Guardian** (phone + OTP) | Child's weekly attendance, latest exam with rank, monthly fee status, results, notices (multiple children supported) |

**How security works:** staff use Firestore directly, protected by `firestore.rules`. Students and guardians never read Firestore — every request goes through `/api/*` routes that run on Vercel with the Admin SDK and return only their own data. Exams are graded on the server, so answer keys never reach a student's browser before the exam ends.

## 1. Set up Firebase (≈10 min)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Build → Firestore Database → Create database** → production mode → location `asia-south1` (Mumbai) or `asia-southeast1` (Singapore).
3. **Firestore → Rules** → paste the contents of `firestore.rules` → **Publish**.
4. **Build → Authentication → Get started**, then enable:
   - **Email/Password** and **Google** (staff)
   - **Phone** (students and guardians)
5. **Authentication → Settings → Authorized domains** → add your Vercel domain later (e.g. `your-app.vercel.app`).
6. **Project settings → General → Your apps → Web (</>)** → register → copy the config values into the `NEXT_PUBLIC_FIREBASE_*` variables.
7. **Project settings → Service accounts → Generate new private key** → from the downloaded JSON copy `project_id`, `client_email` and `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Never commit this file.

### Phone OTP and billing
Firebase currently sends real OTP SMS only on the **Blaze** (pay-as-you-go) plan. On the free plan, add test numbers instead:
**Authentication → Sign-in method → Phone → Phone numbers for testing**:

| Number | Code | Logs in as (with demo data) |
|---|---|---|
| +880 1700000001 | 123456 | Student Rafi Ahmed |
| +880 1800000001 | 123456 | Rafi's guardian |

## 2. Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values from step 1
npm run dev                  # http://localhost:3000
```

1. Open `/login` → **Teacher / Admin** → create an account with an email listed in `ADMIN_EMAILS` → verify the email → you're the admin.
2. On the dashboard press **Load demo data** (6 batches, 12 students, 12 physics questions, one live exam).
3. In another browser (or incognito), log in with `01700000001` / `123456` and take the live exam.

**Free local alternative:** with the [Firebase emulators](https://firebase.google.com/docs/emulator-suite) (`npx firebase-tools emulators:start`, needs Java) uncomment the three emulator lines in `.env.local`. Phone OTP codes then appear in the emulator UI at `localhost:4000`, no billing needed.

## 3. Deploy on Vercel

1. Push this folder to a GitHub repo.
2. [vercel.com/new](https://vercel.com/new) → import the repo (framework: Next.js, no other settings).
3. **Environment Variables** → add everything from `.env.example`. For `FIREBASE_PRIVATE_KEY` paste the whole key including `-----BEGIN…` with the `\n` sequences.
4. Deploy, then add the `*.vercel.app` domain to Firebase **Authorized domains** (step 1.5).

`vercel.json` pins functions to Singapore (`sin1`), the closest Vercel region to Bangladesh.

## Accounts and roles

- **Admin:** any email in `ADMIN_EMAILS`, on first verified login.
- **Teacher:** an admin adds the email under **Staff**; the teacher signs up with it.
- **Student:** logs in with the *Phone* saved on their student record.
- **Guardian:** logs in with the *Guardian phone* on the student record. One number can belong to several children.

## SMS

`SMS_PROVIDER=log` (default) sends nothing and records every message in the `smsLog` collection — use this until you sign up with a gateway.
`SMS_PROVIDER=http` calls `SMS_API_URL` for each message, replacing `{number}` (as `8801XXXXXXXXX`) and `{message}`. Copy the exact URL format from your Bangladeshi gateway's API docs (BulkSMSBD, SSL Wireless, Alpha SMS, etc.). Messages are in Bangla, which counts as Unicode SMS (~70 characters per part), so they cost more parts than English.

## Excel formats

Download templates from the app (Students → *Download Excel template*, Question bank → *Download template*).

- **Students:** `Name, Roll, Batch, Phone, Guardian Phone, Guardian Name` — *Batch* is the batch name or its last part (e.g. `Morning A`).
- **Questions:** `Subject, Chapter, Difficulty, Question, Option A, Option B, Option C, Option D, Answer, Explanation` — *Answer* is A/B/C/D. Math goes between `$…$`, e.g. `$v = u + at$`.

## Project map

```
src/app/admin/…          staff dashboard pages (client, Firestore SDK)
src/app/student/…        student portal + exam screen
src/app/guardian/        guardian portal
src/app/api/…            server routes (Admin SDK): me, student/home, student/exams/[id], …/submit, guardian, sms
src/lib/types.ts         Firestore data model
src/lib/exam-server.ts   grading, shuffling, rank, student summary
src/lib/api-auth.ts      token check + role resolution
firestore.rules          security rules
```

## Not built yet (next steps from the plan)

OMR scanning from a phone photo · AI doubt helper · lecture sheets · nationwide mock rank · mistake notebook / spaced repetition · gamification · written-exam marks · QR attendance · bKash payment gateway (fees record bKash transaction IDs manually for now) · one-device-per-account login · weekly automatic guardian SMS (needs a scheduled job) · Bangla UI translation.
