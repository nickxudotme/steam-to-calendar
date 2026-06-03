#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const command = process.argv[2] || "today";
const args = new Set(process.argv.slice(3));
const rootDir = resolve(import.meta.dirname, "..");
const UMAMI_API_BASE_URL = "https://umami.nickxu.me/api";

loadEnvFile(resolve(rootDir, ".env.local"));
loadEnvFile(resolve(rootDir, ".env"));

const now = Date.now();
const startAt = args.has("--24h") ? now - 24 * 60 * 60 * 1000 : startOfLocalDay(now);
const endAt = now;

switch (command) {
  case "deploys":
    await printDeployments();
    break;
  case "errors":
    await printUmamiReport({ onlyErrors: true });
    break;
  case "events":
    await printUmamiEvents();
    break;
  case "today":
    await printDeployments();
    console.log("");
    await printUmamiReport({ onlyErrors: false });
    break;
  default:
    printUsage();
    process.exitCode = 1;
}

async function printDeployments() {
  console.log("Vercel deployments");
  console.log("------------------");

  try {
    const { stderr, stdout } = await execFileAsync("vercel", ["ls"], {
      cwd: rootDir,
      maxBuffer: 1024 * 1024,
    });
    const lines = `${stderr}\n${stdout}`
      .split("\n")
      .filter(
        (line) => line.includes("Age") || line.includes("nickxudotme-s-projects/steam-to-calendar"),
      )
      .slice(0, 6);
    console.log(lines.join("\n") || "No deployment rows found.");
  } catch (error) {
    console.log(`Could not read Vercel deployments: ${errorMessage(error)}`);
  }
}

async function printUmamiReport({ onlyErrors }) {
  const config = umamiConfig();

  console.log(onlyErrors ? "Umami failure events" : "Umami today");
  console.log(onlyErrors ? "--------------------" : "-----------");

  if (!config.ok) {
    console.log(config.message);
    return;
  }

  const [stats, eventRows] = await Promise.all([
    umamiGet(config, `/websites/${config.websiteId}/events/stats`, {
      endAt,
      startAt,
    }),
    umamiGet(config, `/websites/${config.websiteId}/events`, {
      endAt,
      page: 1,
      pageSize: 100,
      startAt,
    }),
  ]);

  if (!stats.ok || !eventRows.ok) {
    console.log(`Could not read Umami: ${stats.error || eventRows.error}`);
    return;
  }

  const rows = eventRows.data?.data ?? eventRows.data ?? [];
  const events = Array.isArray(rows) ? rows : [];
  const counts = countBy(
    events
      .map((event) => event.eventName || event.name || event.event || event.event_name)
      .filter(Boolean),
  );
  const filteredCounts = onlyErrors
    ? Object.fromEntries(
        Object.entries(counts).filter(([name]) => /fail|error|exception|rejection/i.test(name)),
      )
    : counts;

  const data = stats.data?.data ?? stats.data ?? {};
  if (!onlyErrors) {
    console.log(
      [
        `Window: ${new Date(startAt).toLocaleString()} - ${new Date(endAt).toLocaleString()}`,
        `Events: ${data.events ?? "unknown"}`,
        `Visitors: ${data.visitors ?? "unknown"}`,
        `Visits: ${data.visits ?? "unknown"}`,
        `Unique events: ${data.uniqueEvents ?? "unknown"}`,
      ].join("\n"),
    );
    console.log("");
  }

  printCounts(
    filteredCounts,
    onlyErrors ? "No failure events in the sampled rows." : "No custom events found.",
  );
}

async function printUmamiEvents() {
  const config = umamiConfig();

  console.log("Umami event schema");
  console.log("------------------");

  if (!config.ok) {
    console.log(config.message);
    return;
  }

  const response = await umamiGet(config, `/websites/${config.websiteId}/event-data/events`, {
    endAt,
    startAt,
  });

  if (!response.ok) {
    console.log(`Could not read Umami event data: ${response.error}`);
    return;
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  if (!rows.length) {
    console.log("No event data rows found.");
    return;
  }

  for (const row of rows.slice(0, 50)) {
    console.log(
      `${row.eventName ?? "(unknown event)"}  ${row.propertyName ?? "(no property)"}  ${row.total ?? 0}`,
    );
  }
}

async function umamiGet(config, pathname, params) {
  const url = new URL(`${config.baseUrl}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-umami-api-key": config.apiKey,
      },
    });

    if (!response.ok) {
      return { error: `${response.status} ${response.statusText}`, ok: false };
    }

    return { data: await response.json(), ok: true };
  } catch (error) {
    return { error: errorMessage(error), ok: false };
  }
}

function umamiConfig() {
  const apiKey = process.env.UMAMI_API_KEY?.trim();
  const websiteId =
    process.env.UMAMI_WEBSITE_ID?.trim() || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  const baseUrl =
    process.env.UMAMI_API_CLIENT_ENDPOINT?.trim() ||
    process.env.UMAMI_API_BASE_URL?.trim() ||
    UMAMI_API_BASE_URL;

  if (!apiKey || !websiteId) {
    return {
      message: [
        "Umami API is not configured.",
        "Set UMAMI_API_KEY and UMAMI_WEBSITE_ID in .env.local or your shell.",
        "For self-hosted Umami, create an API key and use https://umami.nickxu.me/api.",
      ].join("\n"),
      ok: false,
    };
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    ok: true,
    websiteId,
  };
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function printCounts(counts, emptyMessage) {
  const entries = Object.entries(counts).sort((first, second) => second[1] - first[1]);

  if (!entries.length) {
    console.log(emptyMessage);
    return;
  }

  for (const [name, count] of entries) {
    console.log(`${count.toString().padStart(4, " ")}  ${name}`);
  }
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
  }
}

function startOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function printUsage() {
  console.log(`Usage: node scripts/ops.mjs <today|deploys|events|errors> [--24h]`);
}
