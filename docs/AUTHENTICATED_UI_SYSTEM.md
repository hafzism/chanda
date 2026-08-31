# Authenticated UI system

The approved landing page is intentionally isolated from the application shell. Authenticated screens use the same warm Chanda identity but a denser operational layout suited to daily support work.

## Design principles

- Warm off-white surfaces, espresso text, terracotta/orange actions, and restrained semantic status colors.
- One clear primary action per task; destructive actions stay visibly separate.
- Minimal copy that explains state or recovery. Decorative helper paragraphs are removed.
- Shared cards, buttons, fields, status banners, navigation, and spacing tokens rather than page-specific approximations.
- Lucide stroke icons only; no emoji icons or mixed icon families.
- No gradients, glow effects, glass decoration, or mascot repetition inside operational screens.

The implementation tokens live in `apps/web/app/app-system.css`. Core primitives include cream surfaces, warm borders, brown text, orange action/focus colors, semantic success/danger colors, an 8-point spacing rhythm, three radii, and restrained elevation.

## Application structure

```text
WorkspaceApplication
├── AppSidebar / mobile navigation
├── Workspace switcher
├── Route title and task actions
└── Route panel
    ├── Inbox
    ├── Knowledge
    ├── Channels
    ├── Analytics / evaluations
    ├── Team
    ├── Billing
    └── AI provider
```

Route panels own their loading, empty, permission, success, recoverable-error, and busy states. Integration setup uses progressive disclosure: disconnected channel cards show one setup action instead of rendering every credential form at once.

## Responsive contract

The review breakpoints are 375, 768, 1,024, and 1,440 CSS pixels.

- At 1,024 and above, persistent navigation and content form a stable two-column application shell.
- Tablet layouts retain full controls while reducing card columns and metadata density.
- Mobile navigation becomes compact, card headers stack intentionally, and status/action rows span the available width.
- Inputs and actions preserve at least a 44-pixel target, body text remains readable, and no route requires horizontal page scrolling.
- Fixed or sticky controls reserve their own space instead of covering content.

The workspace switcher explicitly resets inherited decorative span dimensions; without that reset, the selected workspace label was clipped on narrow screens. Channel card headers also use a mobile grid override so status, title, and actions do not collide.

## Accessibility contract

- Page regions use semantic `main`, `nav`, `section`, `article`, headings, lists, forms, fieldsets, labels, and definition lists.
- Icon-only controls require an accessible name; decorative icons are hidden from assistive technology.
- Keyboard focus remains visible with a warm high-contrast outline.
- Forms use persistent labels, helper text where needed, disabled busy states, inline `role="alert"` errors, and polite success/loading announcements.
- Destructive actions require an explicit confirmation state with a cancel route.
- Navigation marks the active destination in text and visual styling, not color alone.
- Motion is limited to short transform/opacity feedback and disabled under `prefers-reduced-motion`.

## Visual QA method

Authenticated routes were rendered with representative success/empty/configuration states at desktop, tablet, and 375-pixel mobile widths. The review checks hierarchy, wrapping, target size, overflow, visible focus styling, card consistency, and concise state copy. Browser-console errors are treated as regressions.

A pre-launch pass still needs a real Firebase-authenticated workspace, keyboard-only navigation, screen reader output, 200% text zoom, and automated accessibility tooling. Mocked route inspection verifies layout but cannot prove live permissions or provider responses.
