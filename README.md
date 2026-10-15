# Coaching Hub — coaching center management (MVP)

> "Google Classroom shares files. This runs your entire coaching center: exams, results, fees, and parents."

Next.js 16 (App Router) + Firebase (Auth + Firestore), deployed on Vercel.
The app name is a placeholder — change `NEXT_PUBLIC_APP_NAME` and it updates everywhere.

**Free for educational use.** Nothing in the app costs money or moves real money:

- Students and guardians log in with **phone number + PIN** (no paid SMS OTP).
- Absence alerts, results and fee reminders go to the guardian's **in-app Messages** (no paid SMS gateway).
- Fees are records of what was paid offline; the guardian portal has a **demo online payment** that only records a payment marked *Demo*.
- It runs on free tiers: Firebase **Spark** plan + Vercel **Hobby** — or entirely on your own computer with the Firebase emulators.

## What's built

| Who | Can do |
|---|---|
| **Admin / teacher** (email or Google login) | Dashboard · Batches · Students (+ Excel import, login PINs) · Question bank (+ Excel upload, Bangla, KaTeX math) · Create exams (manual pick or one-click generator by chapter + difficulty mix) · Live merit list · Per-question insight (which wrong option students chose) · Print paper in sets A–D with OMR-style answer sheet and answer key · Attendance by tapping names · Fees with bKash/Nagad/cash reference · Notices · Messages to guardians (fee reminders, absences, results) · Staff invites (admin only) |
| **Student** (phone + PIN, no Gmail) | Timed MCQ exam with auto-submit, negative marking, per-student shuffled questions and options, tab-switch detection, progress saved on the device · Instant score · Solutions, explanations and rank after the exam closes · Weak chapters · Attendance, fee status, notices |
| **Guardian** (phone + PIN) | Child's weekly attendance, latest exam with rank, monthly fee status, results, notices, Messages inbox, demo online fee payment (multiple children supported) |

**How security works:** staff use Firestore directly, protected by `firestore.rules`. Students and guardians never read Firestore — every request goes through `/api/*` routes that run with the Admin SDK and return only their own data. Exams are graded on the server, and answer keys stay there until the exam has closed *and* the 90-second late-submit window has passed. PINs are stored only as scrypt hashes; five wrong PINs lock a number for 15 minutes.

## 1. Run it on your computer (free, no account)

Needs Node 20+, Java 21+ and the Firebase CLI (`npm i -g firebase-tools`). Everything runs locally with the [Firebase emulators](https://firebase.google.com/docs/emulator-suite) under the offline project `demo-coaching` — no Firebase account, nothing sent anywhere.

```bash
npm install
```

Copy the *Option A* block from `.env.example` into `.env.local` (set your own `ADMIN_EMAILS` and `LOCAL_ADMIN_PASSWORD`). Then, in one terminal:

```bash
npm run emulators
```

and in a second terminal:

```bash
npm run seed:admin
```

```bash
npm run dev
```

1. Open http://localhost:3000/login → **Teacher / Admin** → sign in with the `ADMIN_EMAILS` address and `LOCAL_ADMIN_PASSWORD`.
2. On the dashboard press **Load demo data** (6 batches, 12 students, 12 physics questions, one live exam). It shows a phone + PIN for a demo student and a demo guardian, once.
3. In another browser (or a private window) choose **Student / Guardian**, log in with one of them and take the live exam.

Emulator data is saved to `.emulator-data` when you stop the emulators (Ctrl+C) and loaded again next time. The emulator UI is at http://localhost:4000.

## 2. Put it online on free tiers (optional)

### Firebase (Spark plan — free)
1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (no billing account needed).
2. **Build → Firestore Database → Create database** → production mode → location `asia-south1` (Mumbai) or `asia-southeast1` (Singapore).
3. **Firestore → Rules** → paste the contents of `firestore.rules` → **Publish**.
4. **Build → Authentication → Get started**, then enable **Email/Password** and **Google** (staff). Phone sign-in is *not* needed — students and guardians use PINs.
5. **Authentication → Settings → Authorized domains** → add your Vercel domain later (e.g. `your-app.vercel.app`).
6. **Project settings → General → Your apps → Web (</>)** → register → copy the config values into the `NEXT_PUBLIC_FIREBASE_*` variables.
7. **Project settings → Service accounts → Generate new private key** → from the downloaded JSON copy `project_id`, `client_email` and `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Never commit this file. (The server uses it to sign student and guardian logins.)

### Vercel (Hobby plan — free for non-commercial use)
1. Push this folder to a GitHub repo.
2. [vercel.com/new](https://vercel.com/new) → import the repo (framework: Next.js, no other settings).
3. **Environment Variables** → add the *Option B*, *Access* and *Fees* values from `.env.example`. For `FIREBASE_PRIVATE_KEY` paste the whole key including `-----BEGIN…` with the `\n` sequences.
4. Deploy, then add the `*.vercel.app` domain to Firebase **Authorized domains**.

`vercel.json` pins functions to Singapore (`sin1`), the closest Vercel region to Bangladesh.

## Accounts and roles

- **Admin:** any email in `ADMIN_EMAILS`, on first verified login.
- **Teacher:** an admin adds the email under **Staff**; the teacher signs up with it.
- **Student:** logs in with the *Phone* on their student record and a PIN. Staff make PINs in **Students → View → Login PINs**; a PIN is shown once, to hand over on paper.
- **Guardian:** logs in with the *Guardian phone* and its PIN. One number (and one PIN) covers several children.
- A number is either a student's own phone or a guardian phone, never both — the app rejects clashes when you add or import students.

## Messages and notices

Absence alerts, exam results and fee reminders are written to the `messages` collection and appear in the guardian's **Messages** card. Notices appear in both the student and guardian portals. There is no SMS, so none of this costs anything.

## Fees and the demo payment

Staff record what was paid (bKash/Nagad transaction ID, cash or bank) and the app works out what is due — nothing is charged through the app. Guardians can also try **Pay online (demo)**: it records a payment marked *Demo* with a `DEMO-…` reference, the fee updates by itself, and staff see a *Demo* badge. No real money moves. Set `DEMO_PAYMENTS=false` to turn it off.

## Excel formats

Download templates from the app (Students → *Download Excel template*, Question bank → *Download template*).

- **Students:** `Name, Roll, Batch, Phone, Guardian Phone, Guardian Name` — *Batch* is the batch name or its last part (e.g. `Morning A`).
- **Questions:** `Subject, Chapter, Difficulty, Question, Option A, Option B, Option C, Option D, Answer, Explanation` — *Answer* is A/B/C/D. Math goes between `$…$`, e.g. `$v = u + at$`.

## Project map

```
src/app/admin/…          staff dashboard pages (client, Firestore SDK)
src/app/student/…        student portal + exam screen
src/app/guardian/        guardian portal (messages, demo payment)
src/app/api/…            server routes (Admin SDK): auth/pin-login, me, student/home, student/exams/[id], …/submit,
                         guardian, guardian/pay-demo, messages, staff/pin, admin/demo
src/lib/types.ts         Firestore data model
src/lib/exam-server.ts   grading, shuffling, rank, student summary
src/lib/api-auth.ts      token check + role resolution
src/lib/pin.ts           PIN hashing, checking and lockout
src/lib/messages.ts      guardian inbox
firestore.rules          security rules
scripts/                 local emulators + local admin seed
```

## Not built yet (next steps from the plan)

OMR scanning from a phone photo · AI doubt helper · lecture sheets · nationwide mock rank · mistake notebook / spaced repetition · gamification · written-exam marks · QR attendance · one-device-per-account login · weekly automatic guardian summary message (needs a scheduled job) · Bangla UI translation.
