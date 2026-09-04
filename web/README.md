# casdey web

The casdey marketing site and waitlist. Next.js 16 (App Router) + Tailwind v4,
built to be deployed on Vercel. The SaaS itself will live in this same app under
its own routes, which is why it is a full Next app rather than a static page.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

`npm run build` runs the production build, `npm run lint` runs ESLint, and
`npx tsc --noEmit` typechecks.

## Pages

- `/` — the landing page. Its hero has a single email field that carries the
  address to `/waitlist` rather than submitting on its own.
- `/waitlist` — the full signup: practice name, email (prefilled if it arrived
  from `/`), practice software, and the FAQ.
- `/homepage` redirects to `/` (see `next.config.ts`), so a link written that
  way still lands somewhere sensible.
- `/privacy` — the waitlist's privacy notice. Not yet complete, see below.

## Brand

Everything visual comes from `../brand assets/casdey-brand-guide.html` (v4,
"Chalk & Struck Gold", Sep 2026). The tokens are mirrored in
`src/app/globals.css` and should not drift from it. Token *names* are inherited
from v2 and are deliberately stale (`--teal` is a gold) because keeping them
lets a whole palette swap land without touching component code:

- Neutrals: Chalk `#F7F7F4` (the ground, pulled slightly cool so gold has
  something to be warm against), White `#FFFFFF`, Mist `#EFEFEA`, Ash `#E2E2DA`,
  Stone `#6D6D63`, Graphite `#4B4B44`, Ink `#15150F`.
- Deep `#16160F` (plus `--deep-raised`, `--deep-line`) for the one inverted
  plane, at most once per screen. Anything on it needs the `.on-deep` scope
  class, which remaps the neutral and gold roles; without it `text-ink` on
  `bg-deep` is invisible.
- Gold is two values, not one. `--teal` Struck Gold `#8F6A10` is the READ value:
  links, icons, small text, borders. `--teal-bright` Leaf `#D4AF37` is the FILL
  value: button fills, panels, the mark's arc, always with near-black on it and
  never the reverse. `--sea` and `--shallow` are the versions for the dark plane
  and for pale gold tints.
- Amber `#C87D16` is the one moment-marker accent. It marks a lapsed member
  booking again and nothing else, never a button or a background.
- `--danger` `#B3261E` / `--danger-soft` carry failure states. Never hardcode a
  red.
- Outfit carries every title and the wordmark. IBM Plex Sans takes everything
  that gets read, at a 17px base and 1.7 line-height. IBM Plex Mono marks
  anything literal.
- The logo lives in `src/components/wordmark.tsx` (`Mark` / `Wordmark` /
  `Logo`), drawn in code so it re-themes with the tokens. Use the `Logo` lockup
  in chrome. `../brand assets/casdey Logo.png` is the v2/v3 wordmark-only file
  and is superseded.
- The page commits to a light appearance rather than following system dark
  mode: the dark bands only read as deliberate when they are the only dark
  thing on the page.

Copy rules, which apply to every string on the site: "casdey" is always
lowercase, and em dashes are never used as punctuation. No invented statistics;
illustrative diagrams (the lapsed-member chart, the hero mockup) say so on
themselves rather than imply real data.

### Design review workflow

Frontend changes go through the `frontend-design` skill and
`brand assets/CLAUDE_DESIGN.md`. `scripts/screenshot.mjs` drives Puppeteer
against the local dev server and saves numbered, never-overwritten screenshots
to `../temporary screenshots/` (gitignored) for before/after comparison:

```bash
node scripts/screenshot.mjs http://localhost:3000 some-label
node scripts/screenshot.mjs http://localhost:3000 mobile-label --mobile
```

## Waitlist

`POST /api/waitlist` takes `{ practice, email, software, website, elapsedMs }`.

- `website` is a honeypot. Anything in it means a bot, and the request gets a
  fake success so it learns nothing.
- `elapsedMs` is how long the form was on screen. Under 1.5s is treated the same
  way.
- There is a best-effort in-process rate limit. On serverless it is per instance,
  so it is a speed bump, not a guarantee.
- Signups go into `public.waitlist_signups` in Supabase. Duplicate emails return
  success without a second row, so the endpoint never reveals whether an address
  is already on the list.
- If the database is unreachable, the signup is emailed to the team instead of
  being dropped. Only if that also fails does the visitor see an error.

Two emails go out per new signup, both via Zoho and neither able to fail the
signup: an alert to `WAITLIST_NOTIFY_TO`, and a confirmation to the practice.

## Database

Supabase, project `casdey`, region `eu-west-1` (Ireland). Apply
`supabase/migrations/0001_waitlist.sql` in the SQL editor. It enables row level
security with no policies, so only the service role can touch the table, and
grants that role explicit `SELECT`/`INSERT` privileges (see the two gotchas
below).

**Two things that will bite a fresh setup, both already hit once:**

1. **`SUPABASE_URL` must be the bare project URL**, e.g.
   `https://xxxxxxxx.supabase.co`, with nothing after it. The Data API settings
   page in the dashboard displays the full REST endpoint
   (`.../rest/v1/`), and pasting that in causes every request to fail with
   `PGRST125 Invalid path specified in request URL` since the client library
   appends `/rest/v1/...` itself.
2. **`service_role` needs an explicit table grant even though it bypasses RLS.**
   `BYPASSRLS` skips row-level policies, not the separate table-level `GRANT`
   layer, and Supabase does not always wire that up automatically for tables
   created via the SQL editor. Without it, every insert fails with
   `42501 permission denied for table`. The migration's `grant` statements
   cover this; if a future table is added by hand, repeat the pattern:
   ```sql
   grant select, insert on public.<table> to service_role;
   ```

## Environment

Copy `.env.example` to `.env.local` and fill it in. The same keys go into
Vercel's project settings. `SUPABASE_SERVICE_ROLE_KEY` bypasses row level
security, so it is server-only: never prefix it with `NEXT_PUBLIC_`, and never
paste it into chat, a commit, or anywhere client-visible.

## Deploying

Vercel, with **Root Directory** set to `web`. Everything else is default. Push
to any branch other than `main` for a preview URL; merging to `main` is
production. `casdey.com` currently points at GoDaddy, so its DNS needs to move
to Vercel (or have records added) before the domain resolves here. Until then
the site is local-only, reachable at `http://localhost:3000` while the dev
server is running.

## Before this goes live

- The privacy notice at `/privacy` needs the controller's legal identity and a
  postal address. Both were deliberately left out rather than invented. See the
  comment at the top of `src/app/privacy/page.tsx`.
- The patient-data commitments on the landing page are promises the product has
  to keep. Read them again before onboarding the first practice.
- A test row (`casdey test practice`) is sitting in `waitlist_signups` from the
  end-to-end verification run on 2026-08-13. Delete it before this table has
  real signups mixed in, or leave it, it was Davide's own call to make.
