# FaZe Vault components

Sources: `faze-vault.html` (SanRy123/friendly-waddle) for structure; the FaZe Clan 2022 Brand Style Guide kit for palette and brand rules. Roles live in `tokens.json` / `tokens.dark.json`; regenerate CSS and Tailwind with `python3 gen_tokens.py`.

Colour usage: `accent` is Red Alert #E4002B and is for FILLS (buttons, badges, bars, markers) with `on-accent` (white) text. Red TEXT, links and focus rings use `accent-text`, which is slightly darker on light and lighter on dark so it stays AA. Brand colours are only red, black and white; keep greys functional (surfaces, borders, muted text).

Brand rules that constrain components (from the guide): marks are never recoloured, outlined, distorted, boxed, rotated or recreated; clear space is 150% of the mark width; minimum mark size is 40px (one-colour version under 60px); white-stroke logo only on dark, red-stroke logo only on light/non-red backgrounds; camo is trademark-protected, 50-150% scale only, and only with FaZe creative approval. Official display faces (Faze Clan Sans, Microgramma, Compressa, DIN, Avenir) are proprietary: this system uses the kit's open General Use fonts (Anton, Source Sans) as stand-ins.
Global: body 16/24 Source Sans 3, headings Anton uppercase, `:focus-visible` = 3px accent outline, 2px offset, on every interactive element. Motion is 250-400ms and fully off under `prefers-reduced-motion`. Layout: 980px content, 20px gutter, stacks below 780px, 40px minimum touch target.

Contrast notes: `border-input` (not `border`) is used on every form control so inputs meet 3:1. `accent` text is safe on `bg` and `surface`. Never put `text-muted` on `accent`.

```
Brand mark slot (header, footer, empty states)
  variants  logo (on dark: white-stroke; on light: red-stroke), wordmark (light/dark pair), one-colour under 60px
  rules     use the supplied files unmodified; 150% clear space; min 40px; never on a same-colour background
  states    placeholder (text wordmark in display font) until asset use is approved
  a11y      <img alt="FaZe Clan"> when it is the only brand text; alt="" if adjacent text names the brand
  status    BLOCKED on approval: asset use needs sign-off from FaZe creative (contact in the guide)

Corner-marker frame
  layout    1px border box, 12px red squares on two opposite corners, square (0 radius) corners
  tokens    accent fill, border colour border
  a11y      markers decorative (pseudo-elements)
  used on   hero blocks, stat panels, section intros

Mono label
  layout    IBM Plex Mono 12/18 500, uppercase, 0.08em tracking, text-muted
  a11y      real text; do not use for long copy (hard to read tracked caps)

Camo texture slot
  layout    decorative background only, never behind body text without a solid panel
  status    BLOCKED on approval and on supplying the original artwork (do not recreate)

App header
  variants  default
  layout    flex, wrap, space-between, 16px y-padding, 4px solid text bottom rule
  tokens    logo display 26px uppercase, "Vault" in accent
  states    n/a
  a11y      <header>; logo is text, not an image; chips are status text, not buttons
  used on   all screens

Chip (status / link badge)
  variants  linked (solid 1.5px text border), unlinked (dashed border, muted text, grey dot), points (accent fill, on-accent text, 15px)
  sizes     one: 13px/600, padding 3px 9px, pill
  states    default; linked/unlinked is the state. Points chip updates without announcing (aria-live off)
  tokens    border-control, radius pill, dot 8px accent (unlinked: border colour)
  a11y      dot is decorative (aria-hidden); state must be in the text ("Epic soon"), never colour alone
  used on   header

Tabs
  variants  one
  sizes     16px/700, padding 10px 16px, 4px selected underline, scrolls horizontally on narrow screens
  states    default (muted), hover (text), selected (text + accent underline), focus-visible, disabled n/a
  tokens    border bottom 1px border; selected underline accent
  a11y      role=tablist/tab, aria-selected, arrow-key roving tabindex, Home/End, panels role=tabpanel labelled by tab
  used on   top navigation (Live, Feed, Party up, Create, Profile, Arcade, Rewards)

Button
  variants  secondary (2px text border, bg fill), primary "red" (accent fill + border, on-accent text)
  sizes     md 14px/700, padding 8px 14px, radius sm, min-height 40px
  states    default, hover (primary: darken 8%; secondary: surface fill), active (translateY 1px), focus-visible, disabled (45% opacity, not-allowed, aria-disabled), loading (spinner + keeps label, aria-busy)
  tokens    border strong, radius sm
  a11y      real <button>, or <a> only for navigation; <summary class="btn"> for disclosure
  used on   post, start a party, join, redeem, predict

Pill toggle (era / game filter)
  variants  single-select (aria-pressed group), multi-select (checkbox chips)
  sizes     14px/600, padding 5-6px 11-12px, pill, 1.5px text border
  states    default, hover (surface), pressed (accent fill, on-accent text), focus-visible, disabled
  a11y      <button aria-pressed>; group has a label; selection also visible as a check glyph, not only colour
  used on   party filters, profile interests

Select / Textarea / Input
  sizes     font inherit, padding 8px, radius sm, 1.5px border-input, full width (select auto in a row)
  states    default, hover, focus-visible (accent outline), disabled, error (danger border + message below, aria-invalid + aria-describedby), filled
  a11y      every control has a visible <label> (13px/600) or aria-label; character counter is polite, not per-keystroke
  used on   feed composer, party form, profile

Card row (person / party / reward)
  variants  person (avatar + name + reason), party (slots + spots left), perk (cost right-aligned)
  layout    flex, 12px gap, 12px y-padding, 1px top rule; party tab uses 20px y-padding
  states    default, hover n/a, empty (dashed outline slot, copy explains how to fill)
  a11y      name is bold text; actions are buttons labelled with the person/party (aria-label "Join Valorant party")
  used on   Party up, Rewards

Avatar
  sizes     md 42px, slot 48px, big 68px with 4px bg ring, circle
  tokens    initials 15/700 white on user-chosen swatch (swatches must be >= 4.5:1 with white; validate on save)
  a11y      decorative when a name sits beside it; otherwise aria-label

Tag
  variants  one: 12px/700, padding 1px 7px, radius xs, surface fill
  a11y      text only

Progress bar
  sizes     8px, radius xs, surface track, accent fill, width transition 400ms
  a11y      aria-hidden when paired with a "N of 40" text line; otherwise role=progressbar with valuenow/min/max

Live screen (stream panel)
  layout    16:9, radius md, dark panel, diagonal accent slash, LIVE badge top-left (accent fill, 13/700), viewers top-right, score in display type
  states    live, ended, loading (skeleton), offline (copy + next match time)
  a11y      region with aria-label; score is real text; badge text "LIVE" not colour only; player events feed the YouTube session API

Prediction panel
  layout    surface fill, radius md, 14px padding, h2 22px
  states    open, locked (match live), submitted (shows stake), won / lost / refunded, insufficient points (error), no points
  a11y      choices are radio group; result announced via aria-live polite
  api       POST /events/:id/predictions

Updates list
  layout    unstyled list, 9px y-padding, 1px rules, round number in accent bold
  a11y      aria-live polite; cap announcements to avoid flooding

Form panel (start a party)
  layout    surface fill, radius md, 14px padding, 2-col grid, button spans both columns, 1 col below 780px
  states    default, submitting, field errors, success
  a11y      <form aria-label>, labels, errors summarised and focus moved to first invalid field

Slot row (party members)
  layout    flex wrap, 64px slots, avatar 48px, name 12/600, empty slot dashed 2px border
  a11y      list; empty slots read "Open spot"

Post
  layout    flex, 12px gap, 14px y-padding, 1px top rule; like button 14/600 muted, pressed = accent
  states    default, liked (aria-pressed), posting, error, empty feed
  a11y      like is a toggle button with count in its label

Toast
  layout    fixed bottom centre, text fill, bg text colour (inverted), radius md, 14/600, max 90% wide, above safe-area inset
  states    hidden, shown (250ms fade), auto-dismiss 4s, error variant uses danger text-on-inverted pairing only if contrast checked
  a11y      role=status (polite); errors role=alert; does not steal focus; pause on hover/focus

Dialog
  layout    native <dialog>, 3px text border, radius lg, 22px padding, max 460px, backdrop 60% black
  states    open, closing, with form, with destructive action
  a11y      showModal() (focus trap, Esc closes), heading labels it, focus returns to opener

Match card (profile)
  layout    4px border in team colour, radius lg, surface fill, title display 24px uppercase
  a11y      team colour is decoration; team name is text

Game card
  layout    auto-fit grid min 210px, 16px gap, 2px text border, radius lg, 14px padding, title Anton 22px
  states    default, hover (surface), focus-visible, selected, empty

Safety note
  layout    13px muted, 4px accent left border, 10px left padding
  used on   Party up (age and privacy statement)

Empty / error / loading states (every list)
  empty     one sentence + the action that fills it
  error     inline message with Retry button, role=alert
  loading   skeleton rows in surface colour, no spinner-only screens
```
