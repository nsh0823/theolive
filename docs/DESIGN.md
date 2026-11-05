---
name: Artisanal Cafe Order System
colors:
  surface: '#fafaef'
  surface-dim: '#dadbd0'
  surface-bright: '#fafaef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4e9'
  surface-container: '#eeefe3'
  surface-container-high: '#e9e9de'
  surface-container-highest: '#e3e3d8'
  on-surface: '#1a1c16'
  on-surface-variant: '#454840'
  inverse-surface: '#2f312a'
  inverse-on-surface: '#f1f1e6'
  outline: '#75786f'
  outline-variant: '#c5c8bd'
  surface-tint: '#556249'
  primary: '#2f3c26'
  on-primary: '#ffffff'
  primary-container: '#46533b'
  on-primary-container: '#b7c6a8'
  inverse-primary: '#bdcbad'
  secondary: '#58624c'
  on-secondary: '#ffffff'
  secondary-container: '#d9e3c8'
  on-secondary-container: '#5c6650'
  tertiary: '#353a2f'
  on-tertiary: '#ffffff'
  tertiary-container: '#4c5145'
  on-tertiary-container: '#bec3b4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e8c8'
  primary-fixed-dim: '#bdcbad'
  on-primary-fixed: '#131f0b'
  on-primary-fixed-variant: '#3e4b33'
  secondary-fixed: '#dce6ca'
  secondary-fixed-dim: '#c0caaf'
  on-secondary-fixed: '#161e0d'
  on-secondary-fixed-variant: '#414a35'
  tertiary-fixed: '#e0e4d4'
  tertiary-fixed-dim: '#c3c8b9'
  on-tertiary-fixed: '#181d13'
  on-tertiary-fixed-variant: '#43493d'
  background: '#fafaef'
  on-background: '#1a1c16'
  surface-variant: '#e3e3d8'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Manrope
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

The design system is crafted for a high-frequency mobile cafe ordering experience, balancing the structured workflow efficiency of quick-service ordering with the warm, refined hospitality of a neighborhood artisanal cafe.

The visual style blends modern corporate clarity with tactile cafe warmth:

- **Global Canvas:** A distinct, cool-tinted backdrop (`#eff4f8`) that establishes atmospheric calm, reduces eye fatigue, and allows pure white product cards to stand out immediately.
- **Card Hierarchy:** High-contrast white surfaces (`#ffffff`) floating over the canvas, borrowing structural clarity and fast-scanning ergonomics from fintech and modern quick-order paradigms.
- **Tone:** Grounded, earthy, and trustworthy. The rich deep olive green anchors primary interactions, while soft sage and pale olive tints provide gentle feedback states and category compartmentalization without visual clutter.

## Colors

The palette relies on deliberate contrast between the atmospheric canvas and physical surfaces:

- **App Background / Canvas:** `#eff4f8` is strictly applied to the global root view, page backdrops, and navigation gutters.
- **Primary (`#46533B` - Deep Olive):** Anchors primary call-to-actions, cart badges, selected order states, and critical navigation landmarks.
- **Secondary (`#AAB49A` - Sage Green):** Applied to active pill filters, secondary action highlights, progress indicators, and seasonal category tags.
- **Tertiary (`#DDE2D2` - Pale Olive):** Subtle tonal fills, selected row highlights, disabled CTA surfaces, and chip container backgrounds.
- **Neutral Primary (`#252720` - Charcoal):** High-legibility typography for item titles, prices, and critical order states.
- **Neutral Muted (`#62695D`):** Secondary meta-text, volume/modifier descriptions, and inactive states.
- **Border / Outline (`#E2E8EE`):** Crisp structural dividers and subtle card edges preventing blur against the `#eff4f8` canvas.

## Typography

Typography prioritizes fast numerical and nutritional legibility under varying mobile lighting conditions. Manrope is specified throughout for its open counters, contemporary geometric structure, and clear numeric tabular figures crucial for currency and item counts.

- **Numerics & Prices:** Displayed with weight `700` and slight tight tracking (`-0.01em`) to create clear scan anchors in the ordering flow.
- **Hierarchy:** Menu category headers use `headline-sm`, menu item titles use `title-md`, and secondary item descriptions or customization tags use `body-sm`.
- **Labels & Microcopy:** Used for badges, store wait-times, and status pills, rendered strictly in `label-md` or `label-sm` with slight positive tracking to preserve clarity at smaller scales.

## Layout & Spacing

The layout is optimized for single-hand mobile interactions, relying on a compact, thumb-accessible spatial hierarchy:

- **Mobile Viewport Grid:** Fluid 4-column structure with an outer canvas margin of `16px` (`margin: 1rem`) and standard gutters of `12px` (`gutter: 0.75rem`).
- **Vertical Cadence:** Multi-item menus use `12px` gaps between product cards. Dense order customization panels (e.g., milk choices, syrup pumps, temperature) use `space-sm` (`8px`) vertical gaps between options.
- **Bottom Clearance:** Screens terminate with a dedicated floating dock or bottom-bar offset of `88px` to guarantee zero overlap with sticky order totals and "Add to Cart" triggers.

## Elevation & Depth

Visual depth is achieved through high-contrast surface containment rather than heavy drop shadows, reinforcing a clean, modern aesthetic:

- **Level 0 (Global Canvas):** Flat `#eff4f8` tone across all viewport safe areas and behind card margins.
- **Level 1 (Card & Module Surfaces):** Pure `#ffffff` containers with a crisp structural hairline border (`1px solid #E2E8EE`) and a micro-diffused ambient shadow (`0 2px 8px rgba(37, 39, 32, 0.04)`).
- **Level 2 (Active Sheets & Floating Headers):** Modals, sticky category tabs, and order summary drawers sit at `#ffffff` with a directional elevation shadow (`0 -4px 16px rgba(37, 39, 32, 0.08)`) and no top border.
- **Level 3 (Toasts & Overlays):** Order confirmation snackbars and pickup alerts use `#252720` solid backgrounds with an intense floating drop shadow (`0 8px 24px rgba(37, 39, 32, 0.16)`).

## Shapes

The interface embraces a balanced modern curvature that feels approachable yet efficient:

- **Standard Containers & Cards:** `16px` (`rounded-lg`) corner radii on product cards, store selector cards, and receipt panels.
- **Interactive Controls:** `12px` (`rounded-md`) corner radii on input fields, quantity adjusters, and option selection tiles.
- **Filter Chips & Action Buttons:** Fully rounded pill shapes (`rounded-full` / `9999px`) on horizontal subcategory pills, temperature toggles (Hot / Iced), and floating sticky order triggers.
- **Thumbnails & Product Imagery:** `12px` inner rounding within product cards to maintain concentricity with the outer card radius.

## Components

### Buttons

- **Primary CTA ("Order Now", "Pay"):** Solid `#46533B` fill, `#ffffff` typography, `rounded-full`, height `52px`, `font-weight: 700`. Active state drops opacity to `0.9` with subtle scale transition (`0.98`).
- **Secondary CTA:** Surface `#DDE2D2`, `#46533B` typography, borderless, `rounded-full`, height `44px`.
- **Tertiary / Outlined:** Transparent background, `1.5px solid #46533B`, `#46533B` text.

### Chips & Filter Pills

- **Unselected:** `#ffffff` surface, `1px solid #E2E8EE` border, `#252720` text, height `36px`, pill-shaped.
- **Selected:** `#46533B` background, `#ffffff` text, no border.
- **Modifier Option Pills (e.g., Oat Milk, Vanilla):** Solid `#ffffff` base with `#DDE2D2` selection outlines; selected item switches to `#DDE2D2` fill with `#46533B` border and check icon.

### Cards

- **Menu Item Card:** `#ffffff` surface, `1px solid #E2E8EE` border, `16px` padding, containing thumbnail image on the right (`80x80px`, rounded `12px`), title in `title-md`, brief description in `body-sm`, and bold price in `label-lg`.
- **Store Status Card:** `#ffffff` surface with a subtle Sage indicator dot (`#AAB49A`) showing current pickup readiness and wait times.

### Lists & Steppers

- **Order Customization List:** Borderless full-width row segments divided by `1px solid #EFF4F8`.
- **Quantity Stepper:** Pill container with `#DDE2D2` background, containing Charcoal (`#252720`) minus/plus glyphs and centered bold count.

### Input Fields

- **Search & Special Instructions:** `#ffffff` background with `#E2E8EE` resting border, switching to `1.5px solid #46533B` on focus. Placeholder text in `#62695D`.

### Checkboxes & Radios

- **Radio (Milk/Size):** Unchecked has `#E2E8EE` outer ring; checked state renders `#46533B` ring enclosing an inner `#46533B` solid dot.
- **Checkbox (Add-ons):** Rounded square (`6px` radius) with `#46533B` background and white checkmark icon when selected.

### Native Navigation

All navigation chrome is rendered by the platform, never rebuilt from custom views:

- **Stacks:** Use native stack navigators (Expo Router `Stack`, backed by `react-native-screens`) so push/pop transitions, swipe-back gestures, and modal presentations match the OS.
- **Headers & Back Buttons:** Use the native header and its built-in back button. Do not hide the header to draw a custom back arrow or title bar; customize only through native header options (title, tint color, large title, header buttons).
- **Bottom Tabs:** Use native tabs (Expo Router `NativeTabs`) so the tab bar renders as a `UITabBar` on iOS and a Material bottom navigation bar on Android.
- **Styling Scope:** Apply this system's tokens only through the options the native components expose (tint, label, and icon colors; fonts where supported). Where a platform convention conflicts with a spec in this document (heights, borders, blur, transitions), the platform wins.

### Bottom Navigation Bar

- **Form:** Rendered natively (see **Native Navigation**) and anchored to the screen bottom; height and safe-area handling follow the platform. Where the platform allows, use a `#ffffff` background with a `1px solid #E2E8EE` top edge.
- **Destinations:** Exactly 4 fixed items, in this order: **Home**, **Order**, **Reward**, **Other**. Do not add, remove, or reorder.
- **Item States:** Active item displays its icon and `label-sm` label in Deep Olive (`#46533B`). Inactive items display identical icons and labels in Neutral Muted (`#62695D`). No badges or indicator dots on tabs; active status is revealed purely through tone.

## Implementation Addendum (customer app, 2026-11-05)

Source of truth for the mobile app is `apps/mobile/global.css`; values below mirror it.

### Token map (light / dark)

| Token                            | Light                | Dark      | Use                                                             |
| -------------------------------- | -------------------- | --------- | --------------------------------------------------------------- |
| `primary`                        | Deep Olive `#46533B` | `#BDCBAD` | Primary buttons, active nav, Olive Stamp card                   |
| `secondary` / `accent` / `muted` | Pale Olive `#DDE2D2` | `#414A35` | Chips, steppers, selected rows                                  |
| `sage`                           | Sage Green `#AAB49A` | `#C0CAAF` | Empty stamp slots, unchecked outlines                           |
| `cream` (new)                    | Warm Cream `#F4F2E9` | `#3A3D32` | Coupon Points card, order number, price summary, profile header |
| `foreground`                     | Charcoal `#252720`   | `#F1F1E6` | Text                                                            |
| `background`                     | `#EFF4F8`            | `#1A1C16` | Page canvas                                                     |
| `card`                           | White                | `#2F312A` | Surfaces                                                        |

Rules: components use tokens only (no hex). Stamps and Points are always distinguishable by
surface and glyph, not color alone: Stamps = solid olive card, leaf glyph, N/goal count and
progress bar; Points = cream wallet card, coin glyph, won amount.

### Typography status

Pretendard (KO) and Manrope (EN) are specified but NOT loaded yet; the app currently renders in
the system font. Proposal (needs approval, adds deps): `pnpm --filter mobile exec expo install
expo-font @expo-google-fonts/manrope`, bundle Pretendard static OTF/TTF files under
`apps/mobile/assets/fonts/` (license: SIL OFL), load via `useFonts` in the root layout before
hiding the splash, then map `--font-sans` in `global.css` `@theme`.

### Logo

`apps/mobile/assets/brand/logo.png` is the user-supplied official logo, copied byte-for-byte and
rendered through `BrandMark` with `resizeMode="contain"` and its native 672:584 aspect ratio
(sign-in hero, Home header compact). Never recolor, crop, or redraw.

### Product imagery

No product photography exists. `Thumbnail` is a Warm Cream placeholder tile with a category glyph;
replace with Storage images using the same footprint (SA-04).

### Reusable components (brief 11)

Bottom nav `(tabs)/_layout.tsx` (native, 4 tabs) | header bell `home/NotificationBell` |
search + cart `order/HeaderActions`, `IconButton` | product card `order/MenuItemCard` |
category nav `order/CategoryTabs` | HOT/ICE `ui/Segmented`, cart `Chip` options |
quantity `ui/QuantityStepper` | cart item `order/CartLineRow` | price summary `order/AmountSummary` |
coupon selection `order/CheckoutOptions#CouponPicker` | point usage `#PointToggle` |
payment method `order/PaymentMethodPicker` (UI only) | stamp card `reward/StampCard` |
coupon card `reward/CouponCard` | order status `order/OrderStatusTracker` |
notification item `home/NotificationItem` | dialogs `ui/ConfirmDialog`, `order/AddToCartSheet` |
states `ui/StateViews` (loading, empty, error, offline) via `ui/QueryBoundary`.
