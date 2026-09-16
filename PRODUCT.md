# PRODUCT.md — Wingman

register: product

## What it is

Meet people worth meeting, around the way you already travel. Someone on your flight,
in your terminal during a layover, or landing in the same city tonight — for a coffee
at the gate, a shared ride into town, dinner, or a business introduction. It is honestly
social *and* professional: never a dating app that pretends otherwise, never only a
networking tool.

## Who it is for

First customers are business-school cohorts (INSEAD MBAs) who converge on the same
weekend flights and share taxis from the airport. After that, anyone who flies often
and would rather meet one person worth meeting than scroll past twenty.

## The scene

An iPhone (402×874), held one-handed in a terminal, on a jet bridge, or in the back of a
cab. Ambient light is whatever the airport gives you: fluorescent concourse, dusk through
glass, a lit cabin at night. The mood is quiet anticipation, not urgency.

## What must stay true

- **Warmth.** This is a real human moment, not a transaction.
- **Restraint.** Home is opened dozens of times a day. Frequently-seen surfaces do not
  animate or shout; the elaborate "your paths cross" moment is rare by construction and
  earns its weight because nothing else competes with it.
- **Trust.** Identity is revealed progressively (first name and one sentence first),
  meets happen on public ground, exact counts are bucketed, and the product says what
  it is holding back rather than hiding it.

## Visual system today

Light-first, warm, photo-led, restrained. Navy ink `#0f1b33`, one Wingman blue accent
`#1f4e9c`, muted trust green, muted amber; canvas `#faf8f5`. Platform type: SF Pro Text
for body, `ui-rounded` (SF Pro Rounded) for display; monospace only for flight codes and
times. No webfont request. Tokens live in `src/design/tokens/`; nothing outside that
folder writes a literal colour. Real photography where it counts (Welcome hero, Person
detail); generated duotone portraits for everyone without an upload.

## Non-goals

No swipe deck. No followers, likes, or scores shown to users (ranking is ordering only).
No exact location, gate, or seat before mutual consent.
