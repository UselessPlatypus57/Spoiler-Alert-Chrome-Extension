# 🛡️ Spoiler Shield

A Chrome extension that blurs likely spoilers for the shows and games you're in the middle of, and gives every page a "danger" rating so you know how risky it is before you scroll.

![Demo](docs/demo.gif)

## Features

- **Personal watch list**: add a show or game plus optional keywords (characters, places) to track
- **Automatic blurring**: posts, comments, and headlines that mention your titles alongside plot-leak language get blurred. Click one to reveal it
- **Danger meter**: a floating badge on every page shows a score from 0 to 100 and a level (Safe, Caution, Danger, Meltdown)
- **Toolbar badge**: the score also appears on the extension icon, color-coded by level
- **One-click reveal/re-hide**: click the floating meter to toggle all flagged items at once
- **Adjustable sensitivity**: Strict, Normal, or Relaxed
- **Works on dynamic sites**: a debounced `MutationObserver` rescans as new content loads (infinite scroll, comment threads)

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the project folder.
4. Pin the extension, open the popup, and add a show or game.

Pages that were already open before you installed the extension need a refresh.

## Usage

1. Click the extension icon.
2. Enter a title (e.g. `Severance`) and, optionally, comma-separated keywords such as character names.
3. Click **Add to my list**. Pages rescan immediately.
4. Browse normally. Flagged items are blurred with a dashed red outline. Click one to reveal it.

| Setting | Effect |
|---|---|
| Enabled | Turns scanning and blurring on or off |
| Strict | Blurs anything scoring 25 or more |
| Normal | Blurs anything scoring 40 or more |
| Relaxed | Blurs anything scoring 60 or more |

## How it works

### Scoring

Each text block (tweet, comment, headline, article) is checked against your list. If it doesn't mention any of your titles or keywords, it's ignored. If it does, it gets a score:

| Signal | Points |
|---|---|
| Mentions a title or keyword on your list | +20 |
| Plot-leak words (`dies`, `twist`, `finale`, `is actually`, ...) | +25 each, up to 3 |
| Generic episode-talk words (`episode`, `theory`, `recap`, ...) | +8 each, up to 3 |
| Author wrote "spoiler" | +20 |

The total is capped at 100. A block is blurred when its score meets your sensitivity threshold. Only the first 2,000 characters of each block are scanned.

### Danger meter

Page danger combines the scores of every related block (plus the page title) with diminishing returns:

```
danger = 100 × (1 − e^(−total / 150))
```

This means one mildly spoilery comment barely moves the meter, while a page full of leaks climbs toward (but never reaches) 100.

| Level | Range |
|---|---|
| Safe | 0 to 14 |
| Caution | 15 to 39 |
| Danger | 40 to 69 |
| Meltdown | 70 and up |

### Architecture

| File | Role |
|---|---|
| `manifest.json` | Manifest V3 config. Only the `storage` permission is requested |
| `content.js` | Scans the page, scores text, blurs elements, renders the floating meter |
| `content.css` | Blur and reveal styles |
| `background.js` | Service worker that sets the toolbar badge text and color |
| `popup.html` / `popup.js` | Settings UI and the current page's reading |

Design notes:

- **Shadow DOM for the meter.** The floating badge lives in a shadow root, so a host site's CSS can't restyle it and it can't leak styles into the page.
- **Settings sync.** Config is stored in `chrome.storage.sync`, so your list follows you across Chrome profiles. Changing any setting rescans open tabs live via `storage.onChanged`.
- **Per-element deduping.** A `WeakSet` tracks elements already scored so rescans stay cheap and nothing is processed twice.
- **Safe DOM building.** The popup builds list items with `textContent` rather than `innerHTML`, so a title you type can never inject markup.
- **Local only.** Nothing is sent over the network. All scanning happens in your browser.

## Project structure

```
.
├── manifest.json
├── background.js
├── content.js
├── content.css
├── popup.html
├── popup.js
└── docs/
    └── demo.gif
```

## Limitations and roadmap

- **Keyword-based, not semantic.** It can't understand context, so it will miss spoilers that don't name a title or keyword, and occasionally blur harmless posts. Adding character names as keywords helps a lot
- **Site selectors need upkeep.** Reddit and X change their markup often. The selector list at the top of `content.js` is the first place to look if blurring stops working on a site
- **Broad permission scope.** It runs on `<all_urls>`. A future version could let you limit it to chosen sites
- **English only.** The leak-word lists and `\b` word-boundary matching assume English text
- **Only the first matching title is used** when a block mentions several titles on your list
- **Settings changes reset reveals.** Editing your list or sensitivity rescans the page, so items you revealed get blurred again

Features for later
  - [ ] Per-site enable/disable
  - [ ] Customizable leak-word lists
  - [ ] Import/export your watch list
  - [ ] Blur images and video thumbnails
  - [ ] Unit tests for the scoring function
  - [ ] Publish to the Chrome Web Store
