# YTLiteDiarrhea AltStore / SideStore Source

An automatically updated AltStore/SideStore source for **YouTube Plus (YTLite)** IPA builds from [diarrhea3/YTLiteDiarrhea](https://github.com/diarrhea3/YTLiteDiarrhea).

A GitHub Actions workflow runs **every hour**, checks for new releases, and commits an updated `source.json` if anything changed.

---

## Add to AltStore / SideStore

Copy this URL and paste it into your store's **Sources** tab:

```
https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO_NAME/main/source.json
```

> Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and the name you gave this repo.

---

## How it works

```
Every hour (GitHub Actions cron)
  └─ scripts/update-source.mjs
       ├─ Calls GitHub API → diarrhea3/YTLiteDiarrhea/releases
       ├─ Finds all .ipa assets in each release
       ├─ Builds source.json (main + iOS 15 app entries)
       └─ Commits & pushes only if something changed
```

- Keeps up to the last **20** releases in the source.
- iOS 15 IPAs are automatically detected (filename contains `15`) and placed in a separate app entry with bundle ID `com.google.ios.youtube.ios15`.
- The workflow uses the built-in `GITHUB_TOKEN` — no extra secrets needed.

---

## Manual trigger

Go to **Actions → Update AltStore Source → Run workflow** to force an immediate update.

---

## Customising

Edit `scripts/update-source.mjs` — the top of the file has clearly labelled config blocks for source metadata, app metadata, and how many versions to keep.
