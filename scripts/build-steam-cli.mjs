import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const GO_VERSION = process.env.STEAM_CLI_GO_VERSION || "1.22.12";
const rootDir = process.cwd();
const sourceDir = resolveSourceDir();
const outputDir = path.join(rootDir, "bin");
const outputPath = path.join(outputDir, "steam-cli");
const ldflags = process.env.STEAM_CLI_LDFLAGS ?? "-s -w -buildid=";

if (process.env.SKIP_STEAM_CLI_BUILD === "1") {
  console.log("[steam-cli] skipping build because SKIP_STEAM_CLI_BUILD=1");
  process.exit(0);
}

if (!sourceDir) {
  throw new Error(
    [
      "Could not find steam-cli source.",
      "Expected vendor/steam-cli, ../steam-cli, or STEAM_CLI_SOURCE_DIR.",
    ].join(" "),
  );
}

mkdirSync(outputDir, { recursive: true });

const go = ensureGo();
const env = {
  ...process.env,
  CGO_ENABLED: "0",
  GOOS: process.env.STEAM_CLI_GOOS || (process.platform === "win32" ? "windows" : process.platform),
  GOARCH: process.env.STEAM_CLI_GOARCH || archToGo(process.arch),
};

console.log(`[steam-cli] building ${sourceDir} -> ${outputPath}`);
console.log(`[steam-cli] target ${env.GOOS}/${env.GOARCH}`);
console.log(`[steam-cli] ldflags ${ldflags || "(none)"}`);

const buildArgs = ["build", "-trimpath", "-buildvcs=false"];
if (ldflags) {
  buildArgs.push("-ldflags", ldflags);
}
buildArgs.push("-o", outputPath, ".");

execFileSync(go, buildArgs, {
  cwd: sourceDir,
  env,
  stdio: "inherit",
});

chmodSync(outputPath, 0o755);
console.log("[steam-cli] build complete");

function resolveSourceDir() {
  const candidates = [
    process.env.STEAM_CLI_SOURCE_DIR,
    path.join(rootDir, "vendor", "steam-cli"),
    path.resolve(rootDir, "..", "steam-cli"),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(path.join(candidate, "go.mod"))) ?? null;
}

function ensureGo() {
  const configured = process.env.GO;
  if (configured && commandWorks(configured)) {
    return configured;
  }

  if (commandWorks("go")) {
    return "go";
  }

  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("Go is required to build steam-cli. Install Go or set GO=/path/to/go.");
  }

  const cacheDir = path.join(rootDir, ".vercel-go");
  const goBin = path.join(cacheDir, "go", "bin", "go");
  if (commandWorks(goBin)) {
    return goBin;
  }

  mkdirSync(cacheDir, { recursive: true });
  const url = `https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz`;
  console.log(`[steam-cli] Go not found; downloading ${url}`);
  execFileSync("bash", ["-lc", `curl -fsSL "${url}" | tar -xz -C "${cacheDir}"`], {
    stdio: "inherit",
  });

  if (!commandWorks(goBin)) {
    throw new Error(`Downloaded Go toolchain is not executable at ${goBin}`);
  }

  return goBin;
}

function commandWorks(command) {
  const result = spawnSync(command, ["version"], { stdio: "ignore" });
  return result.status === 0;
}

function archToGo(arch) {
  switch (arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      return arch;
  }
}
