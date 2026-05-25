# Prompt Battle — First Render (Set 001)
### Beta Web Platform · v0.14

A React + TypeScript + Vite + Tailwind TCG platform for browser-based play.

---

## Local development

```bash
npm install
npm run dev
# → http://localhost:5173
```

Use beta code `FIRSTRENDER-DEV` to log in.

---

## Deploy to GitHub Pages (automatic)

1. Push to your `main` branch
2. Go to **Settings → Pages → Source: GitHub Actions**
3. The `.github/workflows/deploy.yml` workflow builds and deploys on every push

**Important:** In `vite.config.ts`, change `'prompt-battle'` to your actual repo name:
```ts
const BASE = process.env.GITHUB_ACTIONS ? '/YOUR_REPO_NAME/' : '/';
```

---

## Before going live

1. **Beta tokens** — add more in `src/config.ts` → `BETA_TOKENS`
2. **Google Forms** — create Form 5 (Suggest Artist) and paste its ID into `FORMS.SUGGEST_ARTIST` in `src/config.ts`. Update `FIELDS.SUGGEST_ARTIST` entry IDs too.
3. **Announcements** — add JSON files to `public/announcements/` using `announcement-tool.html` (from the old project)
4. **Votes** — edit `public/data/votes.json` to add real design vote questions
5. **Card images** — replace `PH()` placeholder URLs in `src/data.ts` with real image paths once illustrations are ready

---

## File structure

```
src/
├── App.tsx                       ← root, auth gate, routing
├── config.ts                     ← beta tokens, form IDs, glossary
├── data.ts                       ← all 42 cards + prebuilt decks
├── types.ts                      ← TypeScript interfaces
├── utils/forms.ts                ← Google Forms auto-submit, clipboard
└── components/
    ├── BetaGate.tsx              ← token-based auth screen
    ├── TopNavBar.tsx             ← nav with bell + feedback
    ├── LandingHero.tsx           ← home / welcome screen
    ├── RulesBrowser.tsx          ← markdown doc viewer
    ├── CardGallery.tsx           ← gallery + 3D cards + modal + votes
    ├── DeckBuilder.tsx           ← full deck editor (localStorage)
    ├── ArenaBattlefield.tsx      ← play placeholder
    ├── FeedbackModal.tsx         ← inline feedback form (Form 1)
    ├── SuggestArtistModal.tsx    ← suggest artist form (Form 5)
    ├── GlossaryTooltip.tsx       ← hover tooltips for game terms
    └── AnnouncementModal.tsx     ← bell + announcement popup

public/
├── docs/*.md                     ← rules markdown files (fetched at runtime)
├── announcements/                ← announcement JSON files
└── data/votes.json               ← card design vote questions
```

---

*Prompt Battle · First Render (Set 001) · Rules v0.14 · By @aia :)*
