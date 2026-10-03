# KEYBOARD MAP — the inventory operator screens

**Owner:** funnel agent (A5) · **Applies to:** every screen under `/inventory/**` and the
booking staff panel.
**Contract:** WCAG 2.2 AA · **Base:** `docs/funnel/ACCESSIBILITY-SPEC.md` §8
**Priority:** `P0` ships-blocker · `P1` before launch · `P2` nice.

---

## 0. The rule this file exists to satisfy

> **The whole receive flow must be completable without a mouse, in under 40 seconds,
> by a mechanic standing at a shelf with a customer waiting.**

Everything below follows from that sentence. A shortcut that saves two clicks is a
convenience. A flow that works while someone's hand is on a trolley is a requirement.

### 0.1 Non-negotiables

| Rule | Detail |
| --- | --- |
| **No positive `tabindex`, anywhere** | `ACCESSIBILITY-SPEC.md` §8. Natural DOM order only |
| **Roving `tabindex` on every grid** | A 200-row product list is **one** tab stop, arrow keys inside it. 200 tab stops is not keyboard operation, it is a punishment |
| **Every dialog has a focus trap and returns focus** | `Escape` closes it and focus lands back on the trigger |
| **Single-letter shortcuts never fire while typing** | See §0.2. This is the one bug that makes a keyboard-first tool unusable |
| **`Enter` in a dialog never submits something the operator did not look at** | Especially destructive writes, which need an explicit modifier (§7) |
| **Announcements are polite and once** | Never a per-second live region, never a modal alert |

### 0.2 The shortcut guard (the single most important implementation rule in this file)

A single-letter shortcut handler **must** return early, with no side effects, when:

```text
event.defaultPrevented           → someone else handled it
event.isComposing                → an IME is mid-composition (Tagalog on a phone keyboard)
event.ctrlKey || event.metaKey || event.altKey
event.target is input, textarea, select, or [contenteditable]
event.shiftKey                   → `?` and every shifted shortcut except those listed
```

**Why `isComposing` is named explicitly.** This shop types Taglish. On a phone keyboard,
composing `mga` passes through `m`, `g`, `a` as keydown events with `isComposing === true`.
Without that guard, typing a customer's name into a notes field fires `m` (movements), `g`
(goto) and `a` (adjust) on the way. The result is an operator who stops using the keyboard
within a week, and that is unrecoverable.

### 0.3 Dialogs on an operator screen

`Receive`, `Consume`, `Adjust` and `Count` are `role="dialog" aria-modal="true"` with a
focus trap, opened by a key or a button — never on load.

This is not a violation of `DO-NOT.md` §1.6 rule 53 (no modals). That rule exists because a
modal on the **customer** site blocks the one action that matters — the phone. An
operator-initiated dialog on a staff screen blocks no customer action, is dismissed by
`Escape`, has no backdrop dimming the stock list, and is never opened automatically. The
customer-facing ban is absolute; the staff-facing ban is on *interstitials*, and there are
none.

**On mobile** these become full-screen sheets (`100dvh`, the sticky footer owns the bottom,
`FC-1`/`INV-FC-1` respected inside the dialog).

---

## 1. Global — from any `/inventory` screen

| Key | Action | Notes | Pri |
| --- | --- | --- | --- |
| `/` | Focus the search box | From anywhere. Not while typing in a field | **P0** |
| `Escape` | Clear the search, or close the topmost dialog, or return focus from a detail page | One key, three jobs, resolved top-down | **P0** |
| `r` | **Receive** | | **P0** |
| `c` | **Consume** | | **P0** |
| `a` | **Adjust** | | **P0** |
| `k` | **Count** | | **P0** |
| `g` then `d` | Go to **Today** | | **P0** |
| `g` then `l` | Go to **What's low** | | **P0** |
| `g` then `p` | Go to **All products** | | **P0** |
| `g` then `r` | Go to **Order from suppliers** | | **P0** |
| `g` then `m` | Go to **Ledger** | | P1 |
| `g` then `c` | Go to **Counts** | | P1 |
| `g` then `b` | Go to **Bookings** | | **P0** |
| `g` then `.` | Go to the last screen | "Back to where I was", which is what people actually press | P1 |
| `?` | Show or hide the shortcut strip | **A panel in the page flow, never a modal** — see §11 | P1 |
| `F6` | Cycle regions: sidebar → list → toolbar → footer | Standard landmark pattern | P2 |

**Why `g` and not `1`–`5`.** Numeric shortcuts collide with the one thing an operator types
most — quantities. `g` is unambiguous, it never appears in a SKU, a reason or a customer
note, and it survives the mechanic learning it once.

---

## 2. Dashboard — `Today`

| Key | Action | Pri |
| --- | --- | --- |
| `j` / `↓` | Next row in the focused block | **P0** |
| `k` is **Count**, not "next row" | `j`/`k` as up/down would be Vim muscle memory, but `k` is the Count verb and a keyboard-first tool must not have two meanings for one key. **`↓`/`↑` are the only vertical keys.** | — |
| `Enter` | Open the focused row (booking, product, count) | **P0** |
| `o` | Jump to **What's low** | **P0** |
| `R` (shift) | Jump to **Receive** | **P0** |
| `Shift+?` | Shortcut strip | P1 |

**Only the `What's low` block is keyboard-navigable.** Blocks 1 and 2 are one or three rows
each and are reachable with two `Tab`s; giving them an arrow-key model would be ceremony.

---

## 3. Product list and search

| Key | Action | Pri |
| --- | --- | --- |
| `/` | Focus search | **P0** |
| Type | Instant search across **sku, name, size, barcode** — one box, no mode switch | **P0** |
| `↓` / `↑` | Move row focus (roving tabindex, the list is one tab stop) | **P0** |
| `Home` / `End` | First / last row | **P0** |
| `PageDown` / `PageUp` | ± 12 rows | P1 |
| `Enter` | Open the focused product | **P0** |
| `Space` | Toggle selection (used by reorder and bulk views) | **P0** |
| `Shift+Space` | Select / clear the whole visible set | P1 |
| `Alt+r` / `Alt+c` / `Alt+a` / `Alt+k` | Receive / Consume / Adjust / Count **on the focused row**, without opening the detail page | **P0** |
| `Backspace` (empty search) | Clear the search | **P0** |
| `Alt+s` | Cycle the kind filter | P1 |
| `Alt+Enter` | Open the focused product in a new tab | P1 |
| `Escape` | Back to the list, then clear the search | **P0** |

**Rows announce themselves as a sentence.** The focused row's accessible name is
`{sku}, {name}, {size}, {onHand} {unit} on hand, {available} available{ + status}`, where
`{status}` is the badge **word** — `Low`, `Committed`, `Out`, `Ordered`, `Received`. The
badge colour is never the only carrier (`DO-NOT.md` §1.2 rule 17).

---

## 4. Product detail

| Key | Action | Pri |
| --- | --- | --- |
| `r` | Receive this item | **P0** |
| `c` | Use parts from this item | **P0** |
| `a` | Adjust this item | **P0** |
| `k` | Count this line | **P0** |
| `g` then `m` | Focus the ledger | P1 |
| `j` / `k` on the ledger | Next / previous movement | **P0** |
| `Enter` on a movement | Expand the full entry — reason, reference, actor, booking | **P0** |
| `Alt+f` | Filter the ledger by movement kind | P1 |
| `Alt+e` | Edit the product (name, prices, reorder points) | **P0** |
| `Alt+p` | **Print the shelf label** | P1 |
| `Alt+x` | Stop selling this / Put it back | P1 |
| `Escape` | Back to the list, focus on the row you came from | **P0** |

**`Alt+p` prints the shelf label** — `{sku}`, `{name}`, `{size}`, the unit, and the reorder
point. `Product.sku`'s own comment in the schema says it is *"Printed on the shelf label and
read by the mechanic"*, so a label is not a nice-to-have feature; it is the physical
counterpart of the SKU. It is P1 because a printer on the counter is a purchase decision.

**The detail page's stat row is read in one pass:** `{onHand} on hand`, `{reserved} set
aside`, `{available} available`, `{unit}` once, at the end: `28 on hand, 4 set aside, 24
available, oil filters`. Three numbers and their relationship, spoken by one control.

---

## 5. Receive — the whole flow, without a mouse

**This is the deliverable.** Everything else in this file is convenience.

### 5.1 The sequence

| Step | Key | What happens |
| --- | --- | --- |
| 1 | `r` | Receive dialog opens |
| 2 | — | **First open of the session:** focus lands on the **invoice number** field, because the docket is in the operator's hand and it is the one thing that is entered once. **Every later open:** focus lands on the **search** field, because the docket number is remembered from this session and re-typing it would be the definition of friction |
| 3 | type | Invoice or docket number, e.g. `DR-4471` |
| 4 | `Tab` | → search field |
| 5 | type + `Enter` | The scanner or the operator types a sku / barcode / size fragment. `Enter` resolves it, inserts a line, and **moves focus to that line's quantity field** |
| 6 | type | Quantity |
| 7 | `Enter` | **Commits the line and returns focus to the search field.** `Enter` does exactly this and nothing else |
| 8 | repeat 5–7 | Twelve lines in about forty seconds |
| 9 | `Ctrl+Enter` | `Post {n} lines` |
| 10 | — | Server answers; each line's label becomes the server's `onHandAfter`; `Posted {n} lines. {reference} is in the ledger.` |

### 5.2 Receive — the full key table

| Key | Action | Pri |
| --- | --- | --- |
| `Enter` (search) | Resolve and insert a line, focus its quantity field | **P0** |
| `Enter` (quantity) | Commit this line, focus back to search | **P0** |
| `Alt+Enter` (quantity) | Commit this line and **stay** on it | **P0** |
| `Ctrl+Enter` (anywhere) | Post every uncounted line | **P0** |
| `Alt+r` | Focus the reference field | **P0** |
| `Alt+n` / `Alt+p` | Next / previous line | **P0** |
| `Alt+d` | Hold this line (do not post it) | **P0** |
| `Alt+o` | Open the open-count conflict note for the focused line | **P0** |
| `Alt+s` | Focus the free-text reason on the focused line | P1 |
| `Escape` | Close. **Prompt only if lines are entered**: `Close without posting? {n} lines you entered will be kept here for an hour.` | **P0** |
| `Tab` | Natural order: reference → search → line 1 qty → line 1 reason → line 1 hold → line 2 qty → … → post all | **P0** |

### 5.3 Why the scanner is treated as a keyboard

A barcode and SKU scanner is a keyboard that types a string and sends `Enter`. That single
fact drives three rules:

1. **`Enter` is the only commit key for a line.** Not `Space`, not `Tab`. Whatever the
   scanner sends, it commits exactly one line.
2. **After a commit, focus returns to the search field.** A scan is a *search* action; the
   operator never has to aim at anything to receive the next item.
3. **A stray scan landing in the quantity field must be inert.** The quantity field's key
   handler ignores every non-digit key, so `OIL-FLT-015<Enter>` typed into it leaves the
   field unchanged and announces `That's not a number. Scan or search for the item instead.`
   It must not commit a garbage quantity.

### 5.4 What the screen reads aloud on each commit

> `Received 24 oil filters. OIL-FLT-015 is now 28.`

One `aria-live="polite"` region, assertive never. After `Ctrl+Enter`:

> `Posted 3 lines. DR-4471 is in the ledger.`

---

## 6. Consume

| Key | Action | Pri |
| --- | --- | --- |
| `c` | Open | **P0** |
| `Alt+b` | Focus the booking picker | **P0** |
| `Enter` (booking picker) | Pick the booking and load what it reserved | **P0** |
| `Enter` (line qty) | Commit this line, next line | **P0** |
| `Ctrl+Enter` | `Use {n} parts` | **P0** |
| `Alt+r` | Release the surplus on this line | **P0** |
| `Alt+d` | Hold this line | **P0** |
| `Escape` | Close, with the same "kept for an hour" guard | **P0** |

**Refusal recovery by keyboard.** `INSUFFICIENT_STOCK` replaces the commit button with
`Use {available} instead` and `Write this off instead`, both reachable by `Tab` from the
line. The first is `P0`; the second is `P1` and must never be the default focus.

---

## 7. Adjust — including the destructive path

| Key | Action | Pri |
| --- | --- | --- |
| `a` | Open | **P0** |
| `1` / `2` / `3` | **Add** / **Remove** / **Write off** — *only while focus is outside a field* | **P0** |
| `Alt+r` | Focus the reason field | **P0** |
| type + `Enter` (reason) | Accept a preset chip or the typed reason, focus the commit control | **P0** |
| `Alt+Enter` | Commit (the non-destructive path) | **P0** |
| **`Shift+Enter`** | **Commit a destructive move** — `ADJUST_DOWN` or `SHRINK` | **P0** |
| `Escape` | Close | **P0** |

**The destructive confirmation, and why it is a modifier and not a hold.**

The commit control reads `Hold to remove 2 → 2`. **"Hold" is a pointer affordance** and it
is correct on a phone: a 700 ms press is a deliberate, non-accidental act on a small target.
It is the wrong affordance for a keyboard or a switch device — holding a key is exactly what
those input methods cannot do reliably.

**So the keyboard translation is `Shift+Enter`, and both are real.** The button's
`aria-keyshortcuts` is `Shift+Enter`, and the focus-visible ring is on the button. The rule
is that *neither* path is a default: nothing destructive happens on a bare `Enter` in that
dialog, ever. A mechanic who muscle-memorises `Enter` cannot write off stock by accident.

The reason field is **required and focused before the commit control is enabled**, in that
order, so the sequence is `kind → quantity → reason → confirm`. A stock write can never be
completed without a written reason, by any input method.

---

## 8. Count

| Key | Action | Pri |
| --- | --- | --- |
| `k` | Open the count queue, or join the count you are already in | **P0** |
| `Enter` (line number field) | Save this line, move to the next uncounted one | **P0** |
| `Alt+Enter` | Save and **stay** (a second pass over the same aisle) | **P0** |
| `Alt+s` | Skip this line for now | **P0** |
| `Alt+n` | Focus the note field — **required** on an `isSignificant` line | **P0** |
| `Ctrl+Enter` | `Finish counting` (`COUNTING → REVIEW`) | **P0** |
| `Alt+p` | `Post count` (`REVIEW → POSTED`) | **P0** |
| `Escape` | Close. The count is kept and resumable, and the copy says so | **P0** |

**Focus lands on the first uncounted line's number field**, not on the first line. Resuming
a half-finished count is the normal case, and starting from line 1 every time is how counts
get abandoned.

**`expected` is never in the accessible name of a counting row.** The variance is announced
only after the line is saved: `3. We expected 5. 2 less than we thought.` Until then the
row announces `{sku}, {name}, count in {unit}, not counted yet`.

---

## 9. Reorder and order

| Key | Action | Pri |
| --- | --- | --- |
| `↓` / `↑` | Move between lines | **P0** |
| `Space` | Toggle the line | **P0** |
| `Shift+Space` | Toggle every line under the focused supplier | **P0** |
| `Alt+c` | **Call {supplierName}** — opens `tel:` | **P0** |
| `Alt+Shift+c` | Copy the order as a call sheet | **P0** |
| `Alt+s` | Mark the focused line as ordered | **P0** |
| `Alt+Enter` | Mark every selected line as ordered | **P0** |
| `Alt+q` | Change the focused line's quantity | P1 |
| `Escape` | Clear the selection | **P0** |

`Alt+c` and `Alt+Shift+c` are the two buttons the owner presses all day. They are adjacent
on the keyboard on purpose: `Alt` is held, the second key is `c` or `Shift+c`, and the two
are visually adjacent in the same header group. That is the entire "order from suppliers"
flow — select, call, read the list, order later.

**Copy-to-clipboard must degrade to a visible, selectable text block.** Clipboard access is
denied in plenty of mobile browsers, and a copy button that copies nothing is a dead end.
`CTMAP.md` O3's recovery is a `readonly` textarea the operator can long-press.

---

## 10. Ledger and the booking staff panel

| Key | Action | Pri |
| --- | --- | --- |
| `j` / `k` | Next / previous movement | **P0** |
| `Enter` | Expand the entry | **P0** |
| `Alt+f` | Filter by kind | P1 |
| `Alt+p` / `Alt+n` | Next / previous page | **P0** |
| `Alt+r` | Release a reservation | **P0** |
| `Alt+h` | Hold parts for this booking now | **P0** |
| `Alt+b` | Focus the booking reference search | P1 |
| `Escape` | Clear the filter | **P0** |

---

## 11. The shortcut strip, not a shortcut dialog

`?` toggles a **panel in the page flow**, below the toolbar, in the DOM — not a modal. It is
non-trapping, it does not dim anything, it does not take focus, and it pushes content down
rather than covering it.

Content is generated from the same table that implements the handlers, so it cannot drift
out of date — and a QA check asserts that every shortcut in the panel has a live handler and
every live handler appears in the panel.

It is **collapsed by default** and, once dismissed, remembered for the session only.

---

## 12. Announcement contract

| Event | Live region | Text | Pri |
| --- | --- | --- | --- |
| Row focus moves | none | The row's own name | — |
| Stock write committed | `polite`, one region | `Received {qty} {unit}. {sku} is now {onHandAfter}.` | **P0** |
| Stock write refused | `assertive` (it is a failure of an action someone just took deliberately) | `{exact refusal string}` | **P0** |
| Concurrent change | `polite` | `Someone else changed this while you were typing. Here's the current number: {onHand} {unit}.` | **P0** |
| Count line saved | `polite` | `{counted}. We expected {expected}. {variance} less than we thought.` | **P0** |
| Count posted | `assertive` | `Posted. {reference} is closed.` | **P0** |
| Reordered list changed | `polite` | `{n} items · {formatPeso(estimatedCost)}` | P1 |
| Reservation expired mid-job | `assertive` | `The hold on {sku} expired. {n} {unit} went back on the shelf.` | **P0** |
| Navigation | focus move only | Focus lands on the destination's `<h1 tabindex="-1">` | **P0** |

**Never** a per-second announcement, never a `role="alertdialog"`, never a live region that
re-announces on every re-render of a polling list.

---

## 13. Test scripts

Run each at 1280 × 800 and at 360 × 640, keyboard only, with VoiceOver or NVDA.

### T1 — Receive, twelve lines, no mouse
`r` → type `DR-4471` → `Tab` → type `OIL-FLT-015` `Enter` → type `24` `Enter` → ×12 →
`Ctrl+Enter`. **Assert:** twelve ledger rows exist, `reference` on every one is `DR-4471`,
and the operator never left the dialog.

### T2 — The stray scan
Focus a line's quantity field, type `OIL-FLT-015<Enter>`.
**Assert:** the quantity is unchanged, `aria-invalid` is not set, nothing was posted, and
the hint `That's not a number. Scan or search for the item instead.` was announced.

### T3 — No mouse, no accident
Open Adjust, pick `Remove`, type a quantity, type a reason.
**Assert:** a bare `Enter` commits nothing. `Shift+Enter` commits once.

### T4 — The reason cannot be skipped
Open Adjust, fill everything but the reason.
**Assert:** the commit control is `disabled` and `aria-disabled="true"`; `Add a reason` is
the next focusable thing.

### T5 — Single-key guard under composition
Focus the notes field, type `mga` via an IME (composition events).
**Assert:** no dialog opened, no navigation happened, the text field contains `mga`.

### T6 — Roving tabindex
On a 200-row product list from a cold load.
**Assert:** `Tab` from the toolbar lands on the list **once**. 200 further `Tab`s do not
move through the rows. `↓` moves row focus.

### T7 — Focus return
Open Receive, `Escape`, decline the confirmation.
**Assert:** focus is on the trigger button, and the dashboard scroll position is unchanged.

### T8 — Count resumption
Open a count with 40 lines and 6 counted.
**Assert:** the first uncounted line's number field has focus, and no `expected` value is
reachable in the a11y tree until that line is saved.

### T9 — Whole flow at 200 % zoom, 360 px
Complete T1 at 200 % zoom.
**Assert:** no horizontal document scroll; the post-all footer stays reachable; no target
under 44 × 44 px.

### T10 — Reduced motion
`prefers-reduced-motion: reduce`.
**Assert:** skeletons are static, nothing pulses, the flow is unchanged. (`DO-NOT.md` §1.5
rule 52 — the rule is unconditional.)

---

## 14. Keyboard anti-patterns refused

| Refused | Why | Shipped instead |
| --- | --- | --- |
| A positive `tabindex` to reach the search box first | Breaks DOM order and strands the user after any re-render | `/`, from anywhere |
| One `Tab` stop per product row | 200 stops is not keyboard operation | Roving tabindex; the list is one stop |
| `j`/`k` for up/down **and** `k` for Count | Two meanings for one key; muscle memory wins and someone opens the wrong dialog | `↓`/`↑` only |
| A modal shortcut cheatsheet | Covers the stock list for a screen that is one glance long | An in-flow panel toggled by `?` |
| Hold-to-confirm as the **only** destructive path | Unusable with a switch device, a screen reader, or a tremor | `Hold` for pointer, `Shift+Enter` for keyboard, and no bare `Enter` ever |
| A shortcut that fires while typing in a field | Every single-key shortcut becomes a typo | The §0.2 guard, with `isComposing` |
| `Esc` that discards a half-entered receive | Silent data loss; an operator will learn to press `Esc` fast | `Esc` prompts, and the entries are kept for an hour |
| A drag-and-drop reorder | Pointer-only, and precision-hostile on a phone | Reorder by quantity field and `Alt+q` |
| Pinch-zoom-only affordances | Fails WCAG 1.4.4 | Every gesture has a single-key equivalent |