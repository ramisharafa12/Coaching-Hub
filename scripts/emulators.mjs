// Starts the free local Firebase emulators (Auth + Firestore) for project demo-coaching.
// Data is saved to .emulator-data when you stop them (Ctrl+C) and loaded again next time.
//
//   npm run emulators
//
// Needs the Firebase CLI (npm i -g firebase-tools) and Java 21+. If JAVA_HOME isn't set,
// a JDK under "C:\Program Files\Eclipse Adoptium" is used when one is there.

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const env = { ...process.env };
const adoptium = "C:\\Program Files\\Eclipse Adoptium";
if (!env.JAVA_HOME && process.platform === "win32" && existsSync(adoptium)) {
  const jdk = readdirSync(adoptium)
    .filter((d) => /^jdk-(2\d|[3-9]\d)/.test(d))
    .sort()
    .pop();
  if (jdk) {
    env.JAVA_HOME = path.join(adoptium, jdk);
    env.PATH = `${path.join(env.JAVA_HOME, "bin")}${path.delimiter}${env.PATH || env.Path || ""}`;
    delete env.Path;
    console.log(`Using Java from ${env.JAVA_HOME}`);
  }
}

const dataDir = ".emulator-data";
const args = ["emulators:start", "--project", "demo-coaching", "--only", "auth,firestore", "--export-on-exit", dataDir];
if (existsSync(path.join(dataDir, "firebase-export-metadata.json"))) args.push("--import", dataDir);

// The arguments are fixed strings above, so one command line through the shell is safe
// (the shell is what finds firebase.cmd on Windows).
const child = spawn(["firebase", ...args].join(" "), { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
