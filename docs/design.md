# Design Guide

## 1. Visual Identity

### Design Principle
Cyberpunk editorial — dark-first, neon accent palette, typographically bold. The platform should feel like a premium digital magazine published on the blockchain. Complexity is hidden behind clean UI; blockchain actions feel native, not foreign.

---

### 1.1 Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `bg-primary` | `#0A0A0F` | Page backgrounds |
| `bg-secondary` | `#13131A` | Section backgrounds, inputs |
| `bg-surface` | `#1C1C28` | Cards, popovers, sidebars |
| `accent-primary` | `#7C3AED` | CTAs, highlights, active states, XP bar |
| `accent-secondary` | `#06D6A0` | Success, on-chain confirmation, verified badges |
| `brand-warning` | `#F59E0B` | Auction countdown, caution states |
| `brand-danger` | `#EF4444` | Errors, destructive actions |
| `text-primary` | `#F8F8FF` | Headlines, body text |
| `text-secondary` | `#9594A8` | Labels, meta text, placeholder |

**Gradients:**
- Hero text: `from-accent-primary to-accent-secondary` (violet → emerald)
- NFT card backgrounds: `from-accent-primary/20 to-accent-secondary/20`
- Glow effects: `#7C3AED40` (40% opacity violet)

---

### 1.2 Typography

| Role | Font | Weights | Usage |
|---|---|---|---|
| Display | Syne | 400, 500, 600, 700, 800 | H1–H3, NFT titles, creator names, prices |
| Body | DM Sans | 400, 500, 600 | Descriptions, UI labels, body copy |
| Mono | JetBrains Mono | 400, 700 | Wallet addresses, tx hashes, token amounts |

**Scale:**
```
Display XL:   font-size: 4.5rem (72px)   line-height: 1.1
Display L:    font-size: 3.75rem (60px)  line-height: 1.1
H1:           font-size: 3rem (48px)      line-height: 1.2
H2:           font-size: 2.25rem (36px)   line-height: 1.3
H3:           font-size: 1.5rem (24px)    line-height: 1.4
Body L:       font-size: 1.125rem (18px)  line-height: 1.6
Body:         font-size: 1rem (16px)      line-height: 1.5
Body S:       font-size: 0.875rem (14px)  line-height: 1.5
Caption:      font-size: 0.75rem (12px)   line-height: 1.4
```

---

### 1.3 Spacing System (4px base)

```
xs:   4px
sm:   8px
md:   16px
lg:   24px
xl:   32px
2xl:  48px
3xl:  64px
4xl:  96px
```

---

### 1.4 Border Radius

```
sm:   8px    (tags, badges)
md:   12px   (inputs, small cards)
lg:   16px   (cards, panels)
xl:   20px   (featured cards)
2xl:  24px   (large cards, modals)
full: 9999px (pills, avatars)
```

---

## 2. Motion Design

All animations use `ease-out` timing. Platform should feel responsive, not sluggish.

| Interaction | Animation | Duration |
|---|---|---|
| Button hover | `scale(1.05) + glow shadow` | 200ms |
| Button press | `scale(0.95)` | 100ms |
| Page enter | Vertical slide-in from bottom 10px | 200ms |
| Card hover | Border colour + shadow transition | 300ms |
| NFT card hover | Image `scale(1.1)` | 500ms |
| NFT card flip | 3D `rotateY(180deg)` (reveals metadata) | 600ms |
| Purchase confirm | Particle burst expand-and-fade | 600ms |
| Modal open | Fade + scale from 0.95 | 150ms |
| Toast enter | Slide in from right | 200ms |
| XP bar fill | Width transition from 0 | 1000ms ease-out |
| Streak flame | Pulse animation | 2000ms infinite |

---

## 3. Component Patterns

### 3.1 Button Variants

```
Primary:    bg-accent-primary, white text, hover glow, scale micro-interaction
Secondary:  border accent-primary/30, accent text, hover bg-accent-primary/20
Ghost:      no border, text-secondary, hover text-primary + bg-surface
Danger:     bg-brand-danger, white text
```

All buttons: `disabled:opacity-50 disabled:pointer-events-none`

### 3.2 Card Variants

```
card:       bg-surface + border border-white/5 + rounded-2xl
card-hover: card + hover:border-accent-primary/30 + hover:shadow-accent
nft-card:   card-hover + cursor-pointer + image scale on hover
glass:      bg-surface/80 + backdrop-blur-xl + border-white/10
```

### 3.3 Badge/Tag Variants

```
badge-premium: bg-accent-primary/20, text-accent-primary, border accent-primary/30
badge-free:    bg-white/10, text-secondary, border white/10
badge-verified: bg-accent-secondary/20, text-accent-secondary
badge-rare:    bg-accent-primary/40
badge-epic:    bg-accent-secondary/40
badge-legendary: bg-brand-warning/40
```

### 3.4 NFT Card Anatomy

```
┌─────────────────────────────────┐
│  [Tier badge]       [Type icon] │  ← Overlay on image
│                                 │
│         NFT Image               │  ← aspect-square, scale on hover
│    (emoji or real thumbnail)    │
│                                 │
│              [Auction timer]    │  ← Bottom-right overlay (auctions only)
├─────────────────────────────────┤
│  @creator_name ✓                │  ← Creator info
│  NFT Title (truncated)          │  ← font-display font-semibold
│                                 │
│  Price           [Buy/Bid btn]  │  ← Price in INCAM, CTA right-aligned
└─────────────────────────────────┘
```

### 3.5 Content Feed Card Anatomy

```
┌─────────────────────────────────────────────────────┐
│  [Avatar]  Creator Name ✓         [Tier] [Type]     │
│  @username               2h ago                     │
├─────────────────────────────────────────────────────┤
│  Post Title (font-display, large)                   │
│                                                     │
│  Teaser text or ┌─────────────────────────────┐     │
│                 │  🔒  Premium content          │     │
│                 │  [Unlock Access]              │     │
│                 └─────────────────────────────┘     │
├─────────────────────────────────────────────────────┤
│  ♥ 1,240  💬 87  ↗ Share          48,200 views      │
└─────────────────────────────────────────────────────┘
```

### 3.6 Wallet Address Display

Always truncate: `0x1234...abcd` (first 6 + last 4 chars).
Use `font-mono text-sm text-text-secondary` class.
Link to block explorer. Never show full address in the main UI flow.

---

## 4. Key Screen Specifications

### 4.1 Landing Page

| Section | Content |
|---|---|
| NFT Ticker | Fixed bar below navbar; scrolling live price feed |
| Hero | Animated gradient background; headline gradient text; 3 CTAs |
| Stats | 4-column grid: creators, NFTs minted, volume, rewards |
| Featured Creators | 4-column card grid; creator avatar, stats, floor price |
| How It Works | 4-step horizontal flow with numbered cards |

### 4.2 NFT Marketplace

| Element | Spec |
|---|---|
| Layout | Left sidebar (filters) + right main grid |
| Default grid | 3 columns on desktop, 2 on tablet, 1 on mobile |
| Card minimum width | 160px |
| Filters | Content type, tier, listing type, price range, category |
| Sort options | Most Recent, Price Low→High, Price High→Low, Trending |
| View toggle | Grid / List toggle in toolbar |

### 4.3 Content Feed

| Element | Spec |
|---|---|
| Layout | Single column, max-width 4xl (896px) |
| Filters | All / Following / Free / Premium tabs |
| Infinite scroll | Load 20 items per page |
| Premium lock | Full-bleed lock overlay with unlock CTA |
| Mobile | Cards full-width, all interactive at thumb reach |

### 4.4 Reward Centre

| Section | Spec |
|---|---|
| XP progress | Full-width bar with moving indicator dot; streak + multiplier stats |
| Quest board | Vertical list; progress bar per quest; type badges; timer |
| Badge cabinet | 6-column grid; emoji + rarity colour coding; tooltip on hover |
| Leaderboard | Sticky right sidebar; tab for Global/Community/Country; user's own rank pinned at bottom |

### 4.5 Creator Studio — Upload Wizard Steps

```
Step 1: Choose file  →  Step 2: Content details  →  Step 3: NFT config  →  Step 4: Publish
  Drop zone             Title, description          Royalty slider          Review + confirm
  File type display     Content type select         Mint as NFT checkbox    Gas estimate
  Size validation       Tier + access mode          Edition count           Submit
```

---

## 5. Responsive Breakpoints

| Breakpoint | Width | Target |
|---|---|---|
| xs (default) | 375px | Mobile-first baseline |
| sm | 640px | Large phones |
| md | 768px | Tablets |
| lg | 1024px | Desktop |
| xl | 1280px | Wide desktop |
| 2xl | 1536px | Ultra-wide |

**Mobile-first rules:**
- All grids: 1 col → 2 col → 3/4 col
- Sidebar: hidden → overlay drawer → permanent at lg
- NFT cards: full-width on xs, min 160px at all sizes
- Navbar: hamburger menu at <md, full nav at md+

---

## 6. Accessibility Requirements

### Colour Contrast
- Text on background: minimum 4.5:1 (WCAG AA)
- `text-secondary (#9594A8)` on `bg-primary (#0A0A0F)`: 5.8:1 ✓
- `accent-primary (#7C3AED)` on `bg-surface (#1C1C28)`: 4.6:1 ✓

### Keyboard Navigation
- All buttons/links reachable via Tab
- Custom dropdowns: Arrow key navigation, Escape to close
- Modals: Focus trap while open; return focus on close
- Skip-to-main-content link as first focusable element

### Screen Readers
- All images: meaningful `alt` text
- Icon-only buttons: `aria-label` required
- Loading states: `aria-busy="true"` + live region
- Error messages: `role="alert"` or `aria-live="assertive"`
- NFT cards: `role="article"` with descriptive `aria-label`

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
