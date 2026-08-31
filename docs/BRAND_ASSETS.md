# Chanda AI identity and assets

The public product name is **Chanda AI**. New customer-facing text, metadata, widget copy, infrastructure tags, and documentation must use that exact name.

## Panda mark

The canonical raster asset is:

```text
apps/web/public/brand/chanda-panda-logo.png
```

It uses the supplied panda artwork on its original warm orange background. The background is part of the mark: do not remove it, replace it with green, recolor it, or create a transparent mascot cutout. UI usage crops only the thin outer white margin and clips the tile with a soft corner radius. Do not add a border, glow, or shadow.

The same asset is referenced by Next.js metadata for the favicon, shortcut icon, and Apple touch icon. Because the source is a high-resolution RGB PNG, the browser may resample it for small icon sizes; the original project asset remains full resolution.

## Usage rules

- Pair the mark with the text “Chanda AI” where product identity is useful; compact navigation may use the mark alone with an accessible label.
- Keep adequate separation from neighboring icons or status dots.
- Do not repeat the panda as decoration throughout authenticated operational screens.
- Use off-white, cream, espresso, terracotta, and orange. Green is reserved only for truthful semantic success states, never as a logo treatment.
- Never use gradients.

## Compatibility identifiers

Some non-public identifiers retain the earlier `suppline` name to avoid breaking package resolution, database/service defaults, active sessions, production paths, and deployed infrastructure. Examples include the private `@suppline/*` workspace package scope, the current session cookie, PostgreSQL defaults, and `/opt/suppline-ai` deployment path.

These identifiers are not product copy. Rename them only through an explicit compatibility migration with rollback coverage; a cosmetic bulk replacement could log users out, orphan data volumes, or break deployment automation.
