# Nexus HR — Frontend Design Audit

> Audited: 2026-04-21  
> Scope: `frontend/src/**` — 27 files (14 JSX/JS, 13 CSS)

---

## 1. Pages & Routes

| Page | Key | Component | CSS | Notes |
|---|---|---|---|---|
| Login / Register | `/login` | `Login.jsx` | `Login.css` | Tabbed auth, client-side validation |
| Dashboard | `dashboard` | `DashboardHome.jsx` | *(Tailwind only)* | Stat cards + Recent Hires table |
| Employees | `employees` | `EmployeesPage.jsx` | *(Layout.css shared)* | Full CRUD, search, inline credentials toast |
| Departments | `departments` | `DepartmentsPage.jsx` | *(Tailwind only)* | List view, add/delete |
| Org Chart | `orgchart` | `OrgChartPage.jsx` | `OrgChartPage.css` | Drag-pan, scroll-zoom, search/highlight |
| User Management | `users` | `UserManagementPage.jsx` | *(Layout.css shared)* | Admin-only, inline role dropdown |
| My Profile | `profile` | `ProfilePage.jsx` | `ProfilePage.css` | Hero banner, cards, inline phone edit |

**Shared infrastructure**

| Component | CSS | Role |
|---|---|---|
| `Layout.jsx` | `Layout.css` | Shell, topbar, page routing |
| `Sidebar.jsx` | *(Layout.css)* | Nav + account area |
| `Login.jsx` | `Login.css` | Auth forms |
| `EmployeeModal.jsx` | `Modal.css` | Add/edit employee |
| `DepartmentModal.jsx` | `Modal.css` | Add department |
| `ConfirmModal.jsx` | `Modal.css` | Delete confirmation |

---

## 2. Current Styling Approach

Three distinct approaches coexist in the same codebase with no clear rule for when to use each:

### A — Custom CSS classes (`Layout.css`, `Modal.css`, `Login.css`, `OrgChartPage.css`, `ProfilePage.css`)
Scoped BEM-style classes (`btn`, `section-card`, `data-table`, `badge`, `modal-overlay`). Used by: `EmployeesPage`, `UserManagementPage`, `OrgChartPage`, `ProfilePage`, all modals.

### B — Tailwind utility classes
`DashboardHome.jsx` and `DepartmentsPage.jsx` are written entirely in Tailwind (`bg-white`, `rounded-xl`, `text-slate-800`, `p-4`, `gap-6`). These two pages share zero CSS with the rest of the app.

### C — Inline `style={{}}` objects
`UserManagementPage.jsx` and `EmployeesPage.jsx` render avatars, badges, and typography entirely via inline style objects — mixing approach C inside pages that also use approach A.

**Result:** The same UI element (e.g. an employee avatar) is implemented 5 different ways depending on which file renders it.

---

## 3. Inconsistencies

### 3.1 Color Usage

#### Primary blue — three shades in active use
| Value | Source | Usage |
|---|---|---|
| `#3b82f6` | CSS vars, `index.css`, `Layout.css` | Buttons, focus rings, active nav |
| `#2563eb` | CSS `.btn-primary` hover, Tailwind `bg-blue-600` | `DepartmentsPage` add button |
| `#1d4ed8` | CSS `.btn-primary` active | Button active state |

The Tailwind `bg-blue-600` (`#2563eb`) is used as the **default** button colour in `DepartmentsPage` but as the **hover** colour in the custom CSS system — the two pages look visually different at rest.

#### Avatar gradient inconsistency
| Location | Rendering |
|---|---|
| `EmployeesPage`, `UserManagementPage` | `linear-gradient(135deg, #3b82f6, #6366f1)` (inline style) |
| `Sidebar`, `ProfilePage`, `OrgChartPage` | Same gradient (CSS class) |
| `DashboardHome` | `bg-blue-600` — **solid blue, no gradient** |

#### Text colour fragmentation — 4 values for "primary text"
- `#0f172a` — Layout.css, ProfilePage, UserManagementPage inline
- `#374151` — `data-table td` (Layout.css) — a Tailwind gray-700, not a slate value
- `#1e293b` — not directly used but referenced as `--slate-800` in index.css
- `text-slate-900` — Tailwind (`#0f172a`) in Dashboard, `text-slate-800` (`#1e293b`) in DepartmentsPage

`#374151` is a gray (Tailwind `gray-700`), while the rest of the palette is slate. This causes a subtle warm/cool inconsistency in table cell text.

#### Red / error — three values
| Value | Location |
|---|---|
| `#ef4444` | `.btn-danger`, `.error-msg`, `input-error`, auth `input-error` |
| `#dc2626` | `.btn-danger` hover, `auth-error` border, `modal-close` hover |
| `#b91c1c` | `.form-error` text colour |

A user reading an error in a modal sees `#b91c1c`; a user reading an error from `.error-msg` sees `#ef4444`. Two different shades of red in the same UI pass.

#### Role badge — defined 4 separate times
The same object (`admin → amber`, `manager → blue`, `employee → slate`) is copy-pasted into:
1. `Layout.jsx` — `const roleBadge`
2. `UserManagementPage.jsx` — `const roleBadge`
3. `Sidebar.jsx` — `const roleBadgeStyle`
4. `ProfilePage.jsx` — `const roleBadgeStyle`

All four are slightly different (some include `border`, some don't; colour values differ by one step).

---

### 3.2 Spacing

| Context | Custom CSS | Tailwind equivalent | Actual difference |
|---|---|---|---|
| Page outer padding | `24px` (`page-content`) | `p-8` = `32px` (Dashboard, Departments) | **8px gap** |
| Table cell padding | `12px 16px` (`data-table td`) | `p-4` = `16px` all sides | **4px vertical difference** |
| Card padding | `20px` (`stat-card`) | `p-6` = `24px` (Dashboard StatCard) | **4px gap** |
| Section header padding | `16px 20px` | `p-5` = `20px` (Dashboard) | Mixed |
| Gap between stat cards | `16px` (`gap: 16px`) | `gap-6` = `24px` | **8px gap** |

The dashboard and departments page use 8px more outer padding than every other page, making them feel like they belong to a different product.

---

### 3.3 Typography

#### Non-standard fractional font sizes
The custom CSS uses: `10.5px`, `11.5px`, `12.5px`, `13.5px`, `14.5px` — fractional pixel values that have no equivalent in Tailwind and are inconsistent with each other.

#### Table body text
- Custom CSS pages: `13.5px` (`data-table td`)
- Tailwind pages: `text-sm` = `14px` (`DashboardHome`, `DepartmentsPage`)

#### Page/section heading sizes
| Location | Value |
|---|---|
| Topbar page title | `17px` (custom CSS) |
| Dashboard page heading | `text-2xl` = `24px` (Tailwind) |
| Departments page heading | `text-2xl` = `24px` (Tailwind) |
| Employees page header `h3` | `15px` (custom CSS) |
| Section card title | `14.5px` (custom CSS) |
| Dashboard section header | `text-lg` = `18px` (Tailwind) |

Heading sizes jump from `14.5px` → `15px` → `17px` → `18px` → `24px` with no consistent scale.

#### Font family declared twice
`font-family: 'Inter', ...` appears in both `body {}` (index.css) and `.layout {}` (Layout.css). The layout declaration overrides the body one unnecessarily.

---

### 3.4 Border Radius

| Element | Value |
|---|---|
| `.btn` buttons | `8px` |
| Auth submit button | `10px` |
| `DepartmentsPage` add button | `rounded-xl` = `12px` |
| `.modal-card` | `14px` |
| `.auth-card` | `18px` |
| `.section-card` | `12px` |
| `.stat-card` | `12px` |
| `.sidebar-account-btn` | `10px` |
| `.topbar-user` | `20px` |
| Dashboard/Dept cards | `rounded-xl` = `12px` |

Buttons alone have three different radii (8, 10, 12px). No scale exists.

---

### 3.5 Shadow Levels

Custom CSS has 4 ad-hoc shadows; Tailwind pages use `shadow-sm`. They are not aligned:

| Usage | Value |
|---|---|
| `.section-card` | `0 1px 3px rgba(0,0,0,0.07)` |
| `.stat-card` | `0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)` |
| `.stat-card:hover` | `0 8px 24px rgba(0,0,0,0.1)` |
| `.modal-card` | `0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)` |
| Dashboard/Dept cards | `shadow-sm` = `0 1px 2px rgba(0,0,0,0.05)` |

---

### 3.6 Status Badge Rendering

Status badges (`active`, `on_leave`, `inactive`) are rendered two completely different ways:

**Custom CSS (Employees, Org Chart, Profile):** `.badge .badge-active` — a green pill with a dot prefix `●`, strong border via `box-shadow: inset`.

**Tailwind inline (Dashboard):** `px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-700` — no dot, different green shade (`#15803d` vs `text-green-700` = `#15803d`, this one actually matches), but different padding/look.

---

### 3.7 Error Handling Inconsistency

| Page | Error display |
|---|---|
| `EmployeesPage` | Inline state → renders in modal |
| `UserManagementPage` | `alert()` — native browser dialog |
| `DepartmentsPage` | `alert()` — native browser dialog |
| `DashboardHome` | `console.error()` — silently swallowed |
| `Login` | Inline error component |
| All modals | `serverError` prop → `.form-error` |

Three different UX patterns for the same event type.

---

## 4. Duplicated / Dead Code

### Dead code (safe to delete)
| File | Reason |
|---|---|
| `src/components/EmployeeList.jsx` | Replaced entirely by `EmployeesPage.jsx`. No longer imported anywhere. |
| `src/components/EmployeeList.css` | Only used by `EmployeeList.jsx`. |
| `src/components/SystemInfo.jsx` | Used only by `EmployeeList.jsx` (dead). Displays hardcoded Windows specs. |
| `src/components/SystemInfo.css` | Only used by `SystemInfo.jsx`. |
| `src/context/AuthContext.jsx` | `App.jsx` manages auth state directly with `useState`. Context is never consumed. |

### Duplicated logic (should be extracted)
| Pattern | Appears in |
|---|---|
| Role badge style object | `Layout.jsx`, `UserManagementPage.jsx`, `Sidebar.jsx`, `ProfilePage.jsx` |
| Employee avatar element (initials + gradient circle) | `EmployeesPage.jsx` (inline), `UserManagementPage.jsx` (inline), `DashboardHome.jsx` (Tailwind), `OrgChartPage.css` (CSS), `ProfilePage.css` (CSS), `Sidebar.jsx` |
| `emp.firstName?.[0] + emp.lastName?.[0]` initials | 6 files |
| Date formatting (`toLocaleDateString`) | `UserManagementPage.jsx`, `DashboardHome.jsx`, `ProfilePage.jsx` |
| Loading spinner `<p className="status-msg">` | Every page individually |

---

## 5. Proposed Design System

A unified token set that both the custom CSS and Tailwind config should reference.

---

### 5.1 Color Palette

```css
/* Brand */
--color-brand-50:  #eff6ff;  /* input focus bg, icon bg */
--color-brand-100: #dbeafe;  /* manager badge bg */
--color-brand-400: #60a5fa;  /* active nav text */
--color-brand-500: #3b82f6;  /* focus rings, links */
--color-brand-600: #2563eb;  /* PRIMARY button bg — canonical */
--color-brand-700: #1d4ed8;  /* button active */
--color-indigo-500: #6366f1; /* gradient pair with brand-600 */

/* Semantic — success */
--color-success-text: #15803d;
--color-success-bg:   #dcfce7;
--color-success-dot:  #22c55e;

/* Semantic — warning (on_leave) */
--color-warning-text: #b45309;
--color-warning-bg:   #fef3c7;
--color-warning-dot:  #f59e0b;

/* Semantic — error */
--color-error-text:   #dc2626;  /* ONE red, used everywhere */
--color-error-bg:     #fef2f2;
--color-error-border: #fecaca;

/* Neutrals — slate (NO gray-700 #374151) */
--color-text-primary:   #0f172a;  /* headings, strong text */
--color-text-secondary: #475569;  /* body, labels */
--color-text-muted:     #64748b;  /* hints, meta */
--color-text-placeholder: #94a3b8;

--color-border:         #e2e8f0;  /* all borders */
--color-border-light:   #f1f5f9;  /* table dividers */
--color-bg-page:        #f1f5f9;  /* page background */
--color-bg-subtle:      #f8fafc;  /* inputs, section headers */
--color-bg-white:       #ffffff;

/* Dark — sidebar */
--color-dark-900: #0a1628;
--color-dark-800: #0f172a;
--color-dark-700: #1a2540;
```

**Key decisions:**
- Drop `#374151` (gray-700) entirely — replace with `#475569` (slate-600)
- Canonical primary button = `#2563eb` (blue-600), not `#3b82f6` (blue-500)
- One error red: `#dc2626`. The `#ef4444` / `#b91c1c` variants are retired.

---

### 5.2 Spacing Scale

Align with Tailwind's 4px base unit. All padding/margin/gap values must be one of:

```
4px   (space-1)  →  p-1 / gap-1
8px   (space-2)  →  p-2 / gap-2
12px  (space-3)  →  p-3 / gap-3
16px  (space-4)  →  p-4 / gap-4
20px  (space-5)  →  p-5 / gap-5
24px  (space-6)  →  p-6 / gap-6   ← standard page padding
32px  (space-8)  →  p-8 / gap-8
48px  (space-12) →  p-12 / gap-12
```

**Page outer padding standardised to `24px` (`p-6`) everywhere** — currently Dashboard and Departments use `32px`.

---

### 5.3 Font Hierarchy

No fractional pixel sizes. Six steps only:

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-2xl` | 24px | 800 | Page headings (Dashboard h2) |
| `--text-xl` | 20px | 700 | Modal titles |
| `--text-lg` | 17px | 700 | Topbar title, section headers |
| `--text-md` | 15px | 600 | Nav items, card titles, page-header h3 |
| `--text-base` | 14px | 400–500 | Body copy, table cells, descriptions |
| `--text-sm` | 13px | 500 | Meta, sub-labels, button text |
| `--text-xs` | 11px | 600–700 | Badges, column headers, uppercase labels |

Retire: `10.5px`, `11.5px`, `12.5px`, `13.5px`, `14.5px`, `16px` body, `30px` stat value (replace with `--text-2xl` + `font-weight: 800`).

---

### 5.4 Border Radius Scale

```
--radius-sm:   6px    small controls (close button, btn-icon)
--radius-md:   8px    inputs, standard buttons, small cards
--radius-lg:   12px   cards, section-card, stat-card, Tailwind rounded-xl
--radius-xl:   14px   modals only
--radius-auth: 18px   login card only (kept as one-off — larger card = softer feel)
--radius-full: 9999px badges, pills, avatar
```

Retire: `10px` (topbar-user, sidebar-account-btn → move to `--radius-md`), `20px` (topbar-user → `--radius-full`).

---

### 5.5 Shadow Scale

```
--shadow-sm:   0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md:   0 4px 12px rgba(0,0,0,0.10)
--shadow-lg:   0 8px 24px rgba(0,0,0,0.12)
--shadow-xl:   0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)
--shadow-brand: 0 2px 6px rgba(37,99,235,0.35)   (primary button)
--shadow-focus: 0 0 0 3px rgba(37,99,235,0.12)   (input focus ring)
```

Tailwind `shadow-sm` maps to `--shadow-sm` above — add it to `tailwind.config.js` `theme.extend.boxShadow`.

---

### 5.6 Component Tokens (ready to extract)

```
Avatar:   40px × 40px, radius-full, gradient(brand-500 → indigo-500)
Badge:    radius-full, text-xs, font-700, uppercase, letter-spacing 0.05em
Card:     bg-white, border 1.5px border-color, radius-lg, shadow-sm
Button:   radius-md, text-sm, font-600, padding 8px 16px, transition 0.15s
Input:    radius-md, border 1.5px border-color, bg-subtle, focus: border-brand, shadow-focus
Table th: bg-subtle, text-xs, font-700, uppercase, letter-spacing 0.07em, color-text-muted
Table td: text-base, color-text-primary, border-bottom border-light, padding 12px 16px
```

---

## 6. Recommended Actions (priority order)

| Priority | Action |
|---|---|
| 🔴 High | Delete `EmployeeList.jsx`, `EmployeeList.css`, `SystemInfo.jsx`, `SystemInfo.css`, `AuthContext.jsx` |
| 🔴 High | Replace `alert()` in `DepartmentsPage` and `UserManagementPage` with inline error state |
| 🔴 High | Extract `<Avatar />` component — eliminate 6 duplicate implementations |
| 🔴 High | Extract `roleBadge` constants into a shared `src/utils/roles.js` |
| 🟡 Medium | Rewrite `DashboardHome` and `DepartmentsPage` from Tailwind → shared CSS classes (or the reverse — migrate everything to Tailwind) |
| 🟡 Medium | Fix page padding: standardise to `24px` across all pages |
| 🟡 Medium | Replace all fractional font sizes with the 6-step scale |
| 🟡 Medium | Replace `#374151` table cell text with `--color-text-primary` (`#0f172a`) |
| 🟡 Medium | Consolidate error red to single value `#dc2626` |
| 🟢 Low | Wire design tokens as CSS custom properties in `index.css` |
| 🟢 Low | Add `theme.extend` to `tailwind.config.js` mapping tokens to Tailwind names |
| 🟢 Low | Remove duplicate `font-family` declaration from `Layout.css` |
