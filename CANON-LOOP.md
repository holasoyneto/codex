# CANON LOOP — research blueprint (AWAITING USER APPROVAL — research only, nothing built)

*Produced 2026-06-12 by an 8-agent research workflow: 5 research dimensions (sources, legality, pipeline, distribution, standards) + adversarial verification of licensing claims (incl. one correction: alleged NWT takedowns were unsupported). CAVEAT: the infrastructure-limits verifier died at a session limit — GitHub/jsDelivr/IPFS numbers are single-sourced; re-verify before building on them.*

# CODEX CANON LOOP — Blueprint

## 1. THE GAP

Scripture survived 2,000 years of paper because the copying loop never stopped: scribes copied, compared, corrected, and handed off. On silicon that loop has never closed. Every existing digital Bible project breaks at one of four links:

- **Sources don't update.** Static dumps (bolls.life, thiagobodruk) are one-time scrapes; when the upstream fixes an OCR error, the dump stays wrong forever.
- **Corrections don't propagate.** A reader who spots "hcaven" has no path back to the corpus, and even when a repo accepts a fix, deployed clients never learn about it.
- **Maintainers die (digitally).** This is the *demonstrated* killer, not technology: gratis-bible dead since 2022, wldeh/bible-api since mid-2024, BibleNLP/ebible's last release Feb 2023. Single-hero repos rot.
- **Copies aren't verifiable.** A JSON file forwarded over AirDrop carries no proof it's the real text or who published it.

CODEX today inherits all four: its bundles come from unlicensed bolls dumps, have no source/checksum/versification metadata, and update only when the user hand-edits them. THE CANON LOOP closes the circuit: upstream → automated fetch → validation → signed release → CDN → reader → correction PR → back to release — with every artifact content-addressed so any copy, anywhere, is self-verifying.

## 2. THE CORPUS

### GREEN — bundle, mirror, torrent freely (day-one corpus)

| Text | License | Size (raw / gzip) |
|---|---|---|
| Berean Standard Bible (flagship modern EN) | Public domain (dedicated 2023-04-30) | ~4.5 / ~1.4 MB |
| World English Bible | PD (name trademarked — rename derivatives) | ~4.5 / ~1.4 MB |
| Open English Bible | CC0 | ~4 / ~1.2 MB |
| Literal Standard Version | CC BY-SA (required attribution string) | ~4.5 / ~1.4 MB |
| unfoldingWord ULT + UST | CC BY-SA 4.0, git-native | ~9 / ~3 MB |
| KJV, ASV 1901, YLT, Darby | PD (KJV: UK Crown-rights notice only) | ~18 / ~5.5 MB |
| Reina-Valera 1909 (ES), Louis Segond 1910 (FR), Luther 1912 (DE) | PD | ~13 / ~4 MB |
| WLC Hebrew (already shipped) + OSHB morphology | PD text, CC BY 4.0 morphology | 5.8 / 1.4 MB |
| SBLGNT (already shipped) | CC BY 4.0 (relicensed 2023 — add attribution) | 1.8 / 0.4 MB |
| Charles 1913 pseudepigrapha, 1 Enoch, Zohrab (shipped) | PD | ~1.3 / ~0.4 MB |
| Strong's, TSK, BDB, Thayer, OpenBible.info cross-refs (CC BY) | PD / CC BY | ~30 / ~8 MB |

Day-one total: **~15 translations + reference layer ≈ 100 MB raw / ~30 MB gzipped.** Growth path: eBible.org's 1,200+ open translations (full BibleNLP corpus = 5.18 GB raw, ~1.5–2 GB compressed — still one Wikipedia-ZIM's worth) and Sefaria-Export texts filtered to PD/CC0/CC-BY via its per-text license metadata.

### YELLOW — API passthrough only, never persisted
NET Bible (free quotation but content-control + mandatory netbible.org hyperlink — incompatible with immutable P2P bundles) and copyrighted translations served by bolls.life / bible-api.com. Fetch at view time, show publisher attribution, exclude from offline bundles and exports. **Honesty flag (per adversarial review):** passthrough is a sound conservative floor, *not* a verified liability shield — an offline-first PWA that substantially caches red text could itself face infringement claims, and even view-time caching may brush NASB's explicit 1,000-verse electronic-retrieval cap.

### RED — never in the repo, in any form
NIV, ESV, NLT, NASB, CSB, NKJV, AMP, MSG, RSV/NRSV, RV1960, NWT. Gratis licenses cap at 500–1,000 quoted verses, never a complete book; full-Bible JSON exceeds every limit by definition. Enforcement is real and automated: Crossway (via Corsearch) filed 12 DMCA notices against ESV repos in Jul–Aug 2025; HarperCollins UK (via Link-Busters) took down the NKJV file in jadenzaleski/bible-translations on 2025-12-15. One red file can get the whole repo — and its Pages site — disabled. (Corrected: earlier-claimed NWT takedowns are unsupported; Watch Tower notices on file target artwork/publications, not Bible text.)

### LLM extraction does not launder copyright — said plainly
Copyright attaches to the **text itself**, not how you acquired it. A verbatim ESV emitted by a model is the same infringing ESV as one scraped or typed. This is settled doctrine (17 U.S.C. §106 verbatim reproduction); the open LLM lawsuits are about *training*, not whether redistributed verbatim output infringes (it does). State this in CONTRIBUTING.md so future contributors don't try it. **The better alternative:** the BSB is a genuinely good, genuinely modern, genuinely public-domain English Bible. The red translations add brand familiarity, not durability — durability actually *requires* avoiding them.

## 3. THE LOOM

A weekly (not nightly — eBible's real cadence is weekly-to-monthly) GitHub Actions cron in `codex-corpus`:

1. **FETCH** — diff `ebible.org/Scriptures/changelog.txt` + per-zip checksums against stored state; pull changed USFM zips (filter `translations.csv` to Redistributable=true; **fail closed** on gray-background/non-redistributable entries). Also poll release tags of Door43 (UHB/UGNT/ULT/UST), STEPBible-Data, LogosBible/SBLGNT, openscriptures/morphhb, Sefaria-Export.
2. **NORMALIZE** — convert USFM 3 → CODEX Bundle v2 JSON using **usfm-grammar** or **proskomma** (never hand-rolled parsing). Bundles are derived artifacts, reproducible from a cited upstream revision.
3. **VALIDATE** (CI gate, nothing merges without it):
   - verse-count check against the bundle's *declared* versification using ubsicap/versification_json count tables (never a single English table — LXX/Vulgate texts would false-positive; note the mapping sections of those files are historically unvalidated, use counts as authority);
   - per-language character-set whitelist + Unicode NFC check (catches OCR/scrape garbage);
   - cross-translation chapter length-ratio z-score (catches truncation/duplication);
   - JSON schema validation;
   - **golden sha256 freeze** on canonical corpora (WLC, SBLGNT, KJV) — changeable only via explicit human override commit.
4. **PR** — auto-PR with an AI-generated diff digest: verses added/changed/removed per book, before/after text. Review takes minutes. Validator-clean metadata-only updates can auto-merge.
5. **RELEASE** — merge tags a semver release; CI attaches per-translation gzipped assets (2 GB/file limit, unlimited total), regenerates signed `manifest.json`.
6. **CDN** — clients fetch `cdn.jsdelivr.net/gh/<user>/codex-corpus@<pinned-tag>/...`; pinned URLs are cached by jsDelivr effectively forever. Never `@latest`; never raw.githubusercontent.com in client paths (unauthenticated 429s since May 2025).

**Community correction:** PR-based, Door43's protected-branch principle without its multi-stage bureaucracy. CODEOWNERS per corpus directory; PR template requires citation to a printed or authoritative edition for any text change; CI re-runs all validators so the human reviewer judges only the scholarship. Corrections live in `corrections/<translation>.json` overlays (verse-id → {old, new, reason, date, author}), and CI regenerates bundles from USFM + overlay — every fix is a reviewable diff, never a hand-edited JSON.

**Keep-alive engineering:** GitHub disables scheduled workflows after 60 idle days (scheduled runs don't count as activity) — the cron's own PRs plus a monthly heartbeat commit cover this; add a second CODEOWNER and a documented fork-and-redeploy procedure so any reader can become the maintainer. That, more than P2P, is what outlasts a generation.

## 4. THE FORMAT

**CODEX Bundle v2** — backward compatible (all new fields optional):

```json
{
  "format": "codex-bundle/2",
  "translation": "bsb",
  "title": "Berean Standard Bible",
  "language": "en",
  "versification": "eng",
  "license": "PD",
  "licenseUrl": "https://berean.bible/terms.htm",
  "attribution": "",
  "source": {"url": "https://ebible.org/Scriptures/engbsb_usfm.zip",
             "format": "usfm3", "retrieved": "2026-06-11",
             "upstreamVersion": "engbsb_2026-05"},
  "version": "2.0.0",
  "revised": "2026-06-11",
  "checksum": "sha256-…",
  "books": ["gen", "exo", "…"],
  "chapters": {"gen.1": [{"n": 1, "text": "…",
      "note": "corrected 2026-05-01: OCR 'hcaven'->'heaven' (ab3f2e1)",
      "variants": [{"text": "alt reading", "wit": "TR"}]}]}
}
```

- **Per-book splits:** `bibles/bsb/index.json` (metadata + per-book sha256 + sizes) and `bibles/bsb/gen.json` per book. Per-book — not wldeh-style per-chapter — is the offline-PWA sweet spot: ≤66 fetches, and a one-verse fix invalidates one book file, not 5 MB.
- **License enforcement in code:** only `PD | CC0 | CC-BY-* | CC-BY-SA-*` may enter offline caches, exports, or P2P seeds. Yellow/red license values are rejected by the bundler.
- **Variants:** TEI's app/rdg concept flattened to an optional array — only where apparatus matters (SBLGNT, WLC ketiv/qere). No full TEI.

**Versification strategy — store native + map, never force-normalize.** Same words, different addresses across traditions: Psalm-title verses shift ~2,800 verses, Hebrew Joel has 4 chapters vs English 3, Hebrew Mal 3:19–24 = English 4:1–6, 3 John 14/15 splits. Forcing everything into KJV numbering (SWORD's half-trap) silently corrupts texts. Instead: every bundle declares a Copenhagen Alliance scheme id (`org|eng|lxx|vul|rsc|rso`); vendor the small Copenhagen mapping JSONs into `data/modules/`; route all cross-translation lookups through one `mapVerse(ref, from, to)` utility pivoting via `org`; run versification sniffing on unknown texts. Existing bundles: wlc=`org`; sblgnt needs sniffing to confirm; record source URLs for charles/eth-en/zohrab **now**, before provenance is lost.

## 5. THE LAYERS

**Layer 0 — CDN (reliability ~99.9%, ms latency).** Per-translation gzip bundles (~1–1.5 MB each, every file under ~20 MB for jsDelivr's practical cap) on GitHub Pages + jsDelivr pinned-version URLs (multi-CDN Cloudflare+Fastly; serves already-cached files even after repo deletion). Survives: raw-URL rate limits, traffic spikes (~70k full-translation downloads/month fit in Pages' 100 GB soft cap before jsDelivr even matters).

**Layer 1 — Archive + torrent (durability: decades).** Each tagged release: `codex-corpus-vX.Y.Z.tar.zst` as a GitHub Release asset **and** a new immutable Internet Archive item (`codex-corpus-v1.0.0` — never edited in place, IA torrents break on in-place edits). IA auto-generates a torrent with archive.org webseeds, so it works with zero human peers. Hybrid v1+v2 torrents via libtorrent tooling (WebTorrent's v2 support is incomplete — uncertain exact status, verified as of research date). Survives: GitHub account/repo deletion, jsDelivr policy change.

**Layer 2 — Reader-to-reader P2P (best-effort; censorship insurance, not backbone).** WebTorrent in the PWA: opt-in, foreground + Wi-Fi only (documented 80%+ CPU seeding cost; browser peers stop the moment the tab closes), IndexedDB chunk store (default is memory-only), 4–5 WSS trackers including one self-hosted wt-tracker/bittorrent-tracker instance (public WSS ecosystem is small and flaky), HTTP webseeds always listed. Plus Kiwix-style sneakernet: one-tap "Share the Library" exporting the signed bundle via Web Share API Level 2, an import path that verifies the signature, and QR codes carrying dual https+magnet URIs. Survives: GitHub *and* IA going dark, national-level blocking — as long as one reader's device holds a copy.

Honest rating: Layer 0 does 99.9% of the daily work; Layer 2 exists for the 0.1% tail where it's the only thing that matters. Skip paid IPFS pinning (recurring-payment dependency contradicts the goal); publish the corpus CID in the manifest so anyone can pin it for free.

## 6. THE LOOP CLOSED

**Correction flow:** reader taps "report verse" in the PWA → prefilled GitHub issue/PR with verse-id, current text, proposed fix, citation → CI validators run → CODEOWNER merges → release tagged, manifest regenerated and signed → every reader's service worker, on its daily/weekly manifest check (fetches only the tiny manifest), sees the hash change, downloads the one changed book file, verifies sha256 + signature, swaps atomically in IndexedDB, keeps the prior version for rollback. The scribe's loop, closed, at internet speed.

**Bitcoin-spirit guarantees we CAN honestly make:**
- **Content-hash integrity** — every bundle, book file, and release is SHA-256 addressed; any copy from any transport (CDN, torrent, AirDrop, USB) is self-verifying. No blockchain needed: a chain would be theater here — Bitcoin's consensus orders transactions among adversaries; a static corpus needs hashes, signatures, replicas.
- **Authenticity** — minisign-signed manifest (public key in README, in the app's About screen, and in the IA item description so it survives repo deletion); optionally sigstore/cosign in CI for keyless transparency-log proof; signed git tags. Optionally a free OpenTimestamps stamp per release: an honest "existed at time T" proof, nothing more.
- **Replication** — GitHub + a fork under a second account + Codeberg/GitLab CI mirrors + jsDelivr's permanent cache + IA + every reader's IndexedDB. Ten independent copies of a ≤2 GB corpus cost nothing.

**What we CANNOT guarantee:** that anyone seeds (browser peers are tab-lifetime); that GitHub/IA exist in 50 years (only that their death doesn't kill verified copies); trustless consensus on *which text is canonical* — authenticity reduces to the signing key, a trusted-publisher model, not Bitcoin's trustlessness; and that the loop runs unattended forever — the 60-day Actions auto-disable and maintainer mortality mean the real guarantee is the documented fork-and-redeploy path, not immortal automation.

## 7. BUILD PLAN

1. **Legal triage + metadata (1 session).** Add `versification/language/source/license/checksum` to the 5 existing bundles; remove/quarantine any bolls-derived red text; add LICENSES.md + SBLGNT/LSV attributions + KJV UK notice. *Valuable alone: CODEX becomes legally clean and provenance-complete today.*
2. **Bundle v2 + per-book splits + manifest (1–2 sessions).** Splitter, signed manifest.json, client manifest-check + hash-verify + atomic swap in the service worker. *Self-updating client, even with manual releases.*
3. **codex-corpus repo + USFM converter (2 sessions).** New repo; usfm-grammar converter; import BSB, WEB, OEB, LSV, ASV, YLT, Darby, RV1909, Segond, Luther from eBible zips. *Corpus jumps from 5 texts to ~15.*
4. **The Loom (2 sessions).** Weekly Actions cron (changelog diff → convert → validate → auto-PR → tagged release), all five validators, golden hashes, heartbeat, CODEOWNERS + correction PR template.
5. **Versification engine (1–2 sessions).** Vendor Copenhagen mappings, `mapVerse()`, route compare-view and live-API lookups through it.
6. **Layer 1 durability (1 session).** Release tar.zst → GitHub Release + immutable IA item; minisign keypair; publish key in three places; document fork-and-redeploy.
7. **Scholarly layer (2 sessions).** OSHB morphology onto WLC; STEPBible TAHOT/TAGNT/TIPNR; OpenBible cross-refs; Strong's.
8. **Layer 2 + virality (2–3 sessions).** Share/import of signed bundles (Web Share API), QR https+magnet, opt-in WebTorrent with IndexedDB chunk store + self-hosted WSS tracker.
9. **Expansion (ongoing).** More eBible languages; Sefaria (license-filtered); PD ANF/NPNF extraction (avoid mirroring CCEL's formatted files — CCEL claims formatting copyright).

## 8. OPEN QUESTIONS

1. **Repo topology** — separate `codex-corpus` (recommended) vs monorepo? Separate isolates DMCA blast radius and keeps the app repo small, but doubles maintenance surface.
2. **Yellow passthrough at all?** Keeping bolls.life live-fetch for ESV/NIV adds familiar names but keeps a copyright surface and an unlicensed-hobby-server dependency. Pure-green is the safest and most honest posture. Your call on risk vs. reach.
3. **Flagship English default** — BSB (modern, PD) vs WEB vs KJV as the app's default translation.
4. **Signing identity** — personal minisign key (whose machine holds it? succession plan?) vs sigstore keyless tied to the GitHub repo identity (dies with the repo) vs both.
5. **Apple/app-store future** — if CODEX ever wraps as an iOS app: App Store rules around P2P/torrent functionality and offline copyrighted content are stricter than the web; WebTorrent layer may need to be web-only. (Uncertain — not researched this round.)
6. **Second maintainer** — who is the named CODEOWNER #2 / fork-holder? The research is unambiguous that this, not technology, decides whether the loop outlives you.
7. **Scope ambition** — Bible-only first, or Sefaria/patristics in the day-one manifest ("Palantir of the Bible" suggests yes, eventually)?
8. **Hosting username/org** — publish under your personal GitHub account or a dedicated org (an org with two owners is cheap succession insurance).

*(~2,100 words. All claims trace to the research synthesis with adversarial corrections applied; items explicitly flagged uncertain: passthrough liability framing, jsDelivr exact per-file cap (20 vs 50 MB), WebTorrent v2 support status, Apple policy implications.)*
