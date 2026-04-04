#!/usr/bin/env node
// update-source.mjs
// Fetches releases from diarrhea3/YTLiteDiarrhea and writes source.json

import fs from "fs";
import path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const SOURCE_REPO   = "diarrhea3/YTLiteDiarrhea";
const MAX_VERSIONS  = 20;   // how many past releases to keep in the source

const SOURCE_META = {
  name:       "YTLiteDiarrhea",
  identifier: "com.diarrhea3.ytlitediarrhea.source",
  subtitle:   "YouTube Plus (YTLite) builds by diarrhea3",
  description:
    "Automatically updated AltStore/SideStore source for YouTube Plus (YTLite) " +
    "IPA builds from github.com/diarrhea3/YTLiteDiarrhea.",
  iconURL:
    "https://raw.githubusercontent.com/diarrhea3/YTLiteDiarrhea/main/Resources/icon.png",
  headerURL:
    "https://raw.githubusercontent.com/diarrhea3/YTLiteDiarrhea/main/Resources/scr1.jpg",
  website:    `https://github.com/${SOURCE_REPO}`,
  tintColor:  "#FF0000",
};

const APP_META = {
  name:             "YouTube Plus",
  bundleIdentifier: "com.google.ios.youtube",
  developerName:    "diarrhea3 / dayanch96",
  subtitle:         "YouTube with 100+ enhancements",
  localizedDescription:
    "YouTube Plus (YTLite) is a flexible enhancer for YouTube on iOS.\n\n" +
    "• Download videos, audio, thumbnails, posts and profile pictures\n" +
    "• Interface customization: remove feed elements, reorder tabs, OLED mode, Shorts-only mode\n" +
    "• Player settings: gestures, default quality, preferred audio track\n" +
    "• Built-in SponsorBlock\n" +
    "• YouPiP (Picture-in-Picture)\n" +
    "• YTUHD (1440p / 4K unlock)\n" +
    "• Return YouTube Dislikes\n" +
    "• And much more!",
  iconURL:
    "https://raw.githubusercontent.com/diarrhea3/YTLiteDiarrhea/main/Resources/icon.png",
  tintColor: "#FF0000",
  screenshotURLs: [
    "https://raw.githubusercontent.com/diarrhea3/YTLiteDiarrhea/main/Resources/scr1.jpg",
    "https://raw.githubusercontent.com/diarrhea3/YTLiteDiarrhea/main/Resources/scr2.jpg",
    "https://raw.githubusercontent.com/diarrhea3/YTLiteDiarrhea/main/Resources/scr3.jpg",
  ],
  appPermissions: {
    entitlements: [],
    privacy: {
      NSCameraUsageDescription:          "Used for video recording.",
      NSMicrophoneUsageDescription:      "Used for video recording.",
      NSPhotoLibraryAddUsageDescription: "Used to save downloaded media.",
      NSPhotoLibraryUsageDescription:    "Used to access media for uploads.",
    },
  },
};

// iOS 15 gets its own app entry with a separate bundle ID so it appears
// as a distinct install in AltStore/SideStore.
const APP_META_IOS15 = {
  ...APP_META,
  name:             "YouTube Plus (iOS 15)",
  bundleIdentifier: "com.google.ios.youtube.ios15",
  subtitle:         "YouTube Plus — iOS 15 build",
};

// ─── GitHub API helpers ───────────────────────────────────────────────────────

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function ghFetch(url) {
  const res = await fetch(url, { headers: GH_HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} for ${url}: ${body}`);
  }
  return res.json();
}

async function fetchAllReleases(repo) {
  const releases = [];
  let page = 1;
  while (releases.length < MAX_VERSIONS) {
    const batch = await ghFetch(
      `https://api.github.com/repos/${repo}/releases?per_page=30&page=${page}`
    );
    if (!batch.length) break;
    releases.push(...batch);
    if (batch.length < 30) break;
    page++;
  }
  return releases.slice(0, MAX_VERSIONS);
}

// ─── Version builder ─────────────────────────────────────────────────────────

/**
 * Extract a clean version string from the release.
 * Priority: first IPA filename → tag name numeric part → tag name as-is.
 * Example IPA names observed: "YouTubePlus_21.13.6_5.2b4.ipa"
 */
function extractVersion(release, ipaName) {
  // Try to pull the YT version from the IPA filename, e.g. "21.13.6"
  if (ipaName) {
    const m = ipaName.match(/(\d+\.\d+\.\d+)/);
    if (m) return m[1];
  }
  // Fall back to stripping non-numeric chars from the tag
  const tagNumbers = release.tag_name.replace(/[^0-9.]/g, "");
  return tagNumbers || release.tag_name;
}

/**
 * Trim the release body to a reasonable length for AltStore's notes field.
 */
function cleanNotes(body) {
  if (!body) return "";
  return body
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 800);
}

function buildVersionEntry(release, ipa, minOS) {
  return {
    version:              extractVersion(release, ipa.name),
    date:                 release.published_at.split("T")[0],
    localizedDescription: cleanNotes(release.body) || release.name || release.tag_name,
    downloadURL:          ipa.browser_download_url,
    size:                 ipa.size ?? 0,
    minOSVersion:         minOS,
    maxOSVersion:         "99.9",
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching releases from ${SOURCE_REPO}…`);
  const releases = await fetchAllReleases(SOURCE_REPO);
  console.log(`  Got ${releases.length} release(s).`);

  const mainVersions  = [];
  const ios15Versions = [];

  for (const rel of releases) {
    const ipas = (rel.assets ?? []).filter((a) => a.name.endsWith(".ipa"));
    if (!ipas.length) {
      console.warn(`  ⚠ Release ${rel.tag_name} has no IPA assets — skipping.`);
      continue;
    }

    for (const ipa of ipas) {
      const is15 = /ios.?15/i.test(ipa.name) || /15\./i.test(ipa.name);
      const entry = buildVersionEntry(rel, ipa, is15 ? "15.0" : "16.0");
      (is15 ? ios15Versions : mainVersions).push(entry);
    }
  }

  if (!mainVersions.length && !ios15Versions.length) {
    throw new Error("No IPA assets found in any release — aborting.");
  }

  const apps = [];

  if (mainVersions.length) {
    apps.push({ ...APP_META, versions: mainVersions });
    console.log(`  Main app: ${mainVersions.length} version(s). Latest: ${mainVersions[0].version}`);
  }

  if (ios15Versions.length) {
    apps.push({ ...APP_META_IOS15, versions: ios15Versions });
    console.log(`  iOS 15 app: ${ios15Versions.length} version(s). Latest: ${ios15Versions[0].version}`);
  }

  const source = {
    ...SOURCE_META,
    featuredApps: [APP_META.bundleIdentifier],
    apps,
    news: [],
  };

  const outPath = path.resolve("source.json");
  fs.writeFileSync(outPath, JSON.stringify(source, null, 2) + "\n");
  console.log(`✓ Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
