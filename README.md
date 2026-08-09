# Two Pennies England fixtures screen

A fixed 16:9 England fixture display and private editing page for the Basement screen.

## What it does

- Shows one featured England fixture and up to three later fixtures in chronological order.
- A single pinned fixture becomes featured and is removed from the smaller list.
- Timed fixtures remain until 45 minutes after kick-off; TBC fixtures remain through their date.
- Hidden fixtures never appear.
- Falls back to a clean “Every Televised England Game” message on the approved England/Basement background when nothing is eligible.
- Keeps a last-known-good browser copy if the data service is temporarily unavailable.
- Provides password-gated add, edit, delete, hide, pin and live 16:9 preview controls at `/admin`.
- Imports only events containing England from the private Live Football On TV calendar each day, with an on-demand sync button in the admin.
- Keeps imported hide/pin choices and manual corrections when the calendar changes; deleting an imported fixture suppresses it from later syncs.
- Keeps a successful admin login active on that device for 30 days using a signed, secure, HTTP-only cookie; “Lock admin” clears it immediately.
- Identifies World Cup, European Championship, qualifying, Nations League and friendly fixtures automatically; recognised competitions use bundled monochrome marks, friendlies use a simple text label, and “Other” leaves the logo slot blank.

## Netlify setup

1. Connect this repository to a separate Netlify site. No build command is required; the publish directory is `.`.
2. Add a secret environment variable named `ADMIN_PASSWORD`. This protects all fixture changes. Do not put it in this repository.
3. Add the private calendar subscription URL as `LIVE_FOOTBALL_TV_CALENDAR_URL`. Never commit that URL.
4. Deploy, visit `/admin`, enter the password, and select **Sync TV calendar** once. Netlify then refreshes it automatically every day at 04:17 UTC.

Fixture data lives in a strongly consistent, site-scoped Netlify Blobs store and therefore persists across deploys. Public display data is read-only; writes require a valid server-issued admin session.

## Local development

Install dependencies, set `ADMIN_PASSWORD` in a local `.env`, then run `npm run dev`. Run `npm test` for the fixture-selection tests.

## Artwork and type

The approved 1920×1080 oxblood England/Basement artwork is included as the fixed background. Fixture text uses the bundled Roboto webfont so the display is consistent on AbleSign and Fire TV devices. Transparent warm-ivory PNG marks are bundled for the World Cup, EURO, European Qualifiers and Nations League; friendlies use plain text and “Other” is blank. The screen makes no third-party image requests.
