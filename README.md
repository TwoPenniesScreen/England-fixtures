# Two Pennies England fixtures screen

A fixed 16:9 senior England men's fixture display and private editing page for the Basement screen.

## What it does

- Shows one featured England fixture and up to three later fixtures in chronological order.
- A single pinned fixture becomes featured and is removed from the smaller list.
- Timed fixtures remain until, but not including, exactly 45 minutes after kick-off; TBC fixtures remain through their Europe/London calendar date.
- Hidden fixtures never appear.
- Falls back to a clean “Every Televised England Game” message on the approved England/Basement background when nothing is eligible.
- Keeps a last-known-good browser copy if the data service is temporarily unavailable.
- Provides password-gated add, edit, delete, hide, pin and live 16:9 preview controls at `/admin`.
- Imports only explicitly recognised senior England men's events from the private Live Football On TV calendar each day, with an on-demand sync button in the admin. Women, youth, B-team and unrelated names containing “England” are rejected.
- Keeps imported hide/pin choices and manual corrections when the calendar changes; deleting an imported fixture suppresses it from later syncs.
- Keeps a successful admin login active on that device for 30 days using a signed, secure, HTTP-only cookie; “Lock admin” clears it immediately.
- Identifies World Cup, European Championship, qualifying, Nations League and friendly fixtures automatically; recognised competitions use text labels and “Other” leaves the competition slot blank.

## Signage lifecycle and time

AbleSign normally creates or loads this page for each playlist appearance. The page immediately renders a validated last-known-good browser copy or the branded fallback, makes one bounded request for the current stored fixture data, and then keeps any already-visible fixture layout stable for that page instance. There is no internal polling or fixture rotation.

All fixture eligibility and date boundaries are calculated explicitly in `Europe/London`, independent of the player device timezone. Calendar timestamps support London `TZID` values, UTC `Z` values and all-day `VALUE=DATE` entries. Unsupported timezone identifiers and invalid timestamps are rejected rather than guessed.

## Netlify setup

1. Connect this repository to a separate Netlify site. No build command is required; the publish directory is `.`.
2. Add a secret environment variable named `ADMIN_PASSWORD`. This protects all fixture changes. Do not put it in this repository.
3. Add the private calendar subscription URL as `LIVE_FOOTBALL_TV_CALENDAR_URL`. Never commit that URL.
4. Deploy, visit `/admin`, enter the password, and select **Sync TV calendar** once. Netlify then refreshes it automatically every day at 04:17 UTC. The provider is contacted only by this scheduled or administrator-triggered sync; public display loads read the stored Blob.

Fixture data lives in a strongly consistent, site-scoped Netlify Blobs store and therefore persists across deploys. Public display data is read-only; writes require a valid server-issued admin session.

## Local development

Install dependencies with `pnpm install`, set `ADMIN_PASSWORD` in a local `.env`, then run `pnpm dev`. Run `pnpm test` for the regression suite.

## Artwork and type

The approved 1920×1080 oxblood England/Basement artwork is served as a versioned WebP fixed background; the original JPEG remains in the repository for exact rollback. Fixture text uses the bundled Roboto webfont so the display is consistent on AbleSign and Fire TV devices. Competitions use plain text and “Other” is blank. The screen makes no third-party image requests.
