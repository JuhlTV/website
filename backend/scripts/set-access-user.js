import dotenv from "dotenv";
import {
  initializeFileStore,
  upsertUserWithPassword
} from "../src/services/fileStore.js";

dotenv.config();

function parseArgs(argv) {
  const args = {
    username: "",
    password: "",
    role: "benutzer"
  };

  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    const next = argv[i + 1];

    if (!part.startsWith("--")) {
      positional.push(part);
      continue;
    }

    if (part === "--username" && next) {
      args.username = next;
      i += 1;
      continue;
    }

    if (part === "--password" && next) {
      args.password = next;
      i += 1;
      continue;
    }

    if (part === "--role" && next) {
      args.role = next;
      i += 1;
      continue;
    }
  }

  if (!args.username && positional[0]) {
    args.username = positional[0];
  }
  if (!args.password && positional[1]) {
    args.password = positional[1];
  }
  if (args.role === "benutzer" && positional[2]) {
    args.role = positional[2];
  }

  // npm workspace forwarding may pass: <password> <role>
  if (
    positional.length === 2
    && ["benutzer", "geraetewart"].includes(positional[1])
    && !argv.some((part) => part === "--username" || part === "--password")
  ) {
    args.username = "";
    args.password = positional[0];
    args.role = positional[1];
  }

  return args;
}

async function run() {
  const parsed = parseArgs(process.argv.slice(2));
  const role = parsed.role;
  const username = parsed.username || (role === "geraetewart" ? "geraetewart" : "");
  const password = parsed.password;

  if (!username || !password) {
    console.error("Usage: npm run access:set -- --password <pass> [--role geraetewart] [--username <name>]");
    console.error("Hinweis: Bei Rolle 'geraetewart' ist --username optional und wird auf 'geraetewart' gesetzt.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Passwort muss mindestens 8 Zeichen haben.");
    process.exit(1);
  }

  if (!["benutzer", "geraetewart"].includes(role)) {
    console.error("Rolle muss 'benutzer' oder 'geraetewart' sein.");
    process.exit(1);
  }

  await initializeFileStore();
  const result = await upsertUserWithPassword({ username, password, role });

  if (result.created) {
    console.log(`Benutzer '${username}' wurde erstellt (${role}).`);
  } else {
    console.log(`Benutzer '${username}' wurde aktualisiert (${role}).`);
  }
}

run().catch((error) => {
  console.error("Script fehlgeschlagen:", error.message);
  process.exit(1);
});
