# DuedGusto — Interface Design System

## Direction & Feel

DuedGusto is a POS/cash register management system for restaurants and retail.
The interface is **business-focused, data-entry oriented** with a **warm, approachable** tone.
Dense components optimize for efficiency; amber primary color keeps it friendly.

## Theme

- **Primary:** `#ffab40` (warm amber)
- **Secondary:** `#bf360c` (deep red)
- **Mode:** Light/Dark with system preference detection
- **All form controls:** `size="small"`, `margin="dense"`

## Depth Strategy

- **Borders-only** via `Paper variant="outlined"`
- No drop shadows on content cards
- Paper sections use `p: 2.5` for internal padding

## Spacing

- **Base unit:** 8px (MUI default)
- **Section gap:** `gap: 2.5` (20px) between Paper sections via flex column
- **Grid spacing:** `spacing={2}` (16px) between form fields
- **Section header margin:** `mb: 2` (16px) below Typography header

## Typography

- **Page title:** `Typography variant="h5"` with `gutterBottom`
- **Section header:** `Typography variant="subtitle1" fontWeight={600}` with `mb: 2`
- **Helper text:** `Typography variant="body2" color="text.secondary"`

## Detail Page Pattern

Every detail page follows this structure:

```
Formik wrapper
  Form noValidate
    FormikToolbar (actions: Edit/Save/New/Delete)
    Box.scrollable-box (marginTop: 1, paddingX: 2, overflow: auto, height: calc(100vh - 64px - 41px))
      Typography h5 (page title)
      Box (display: flex, flexDirection: column, gap: 2.5)
        Section 1 — Paper variant="outlined" p={2.5}
          Typography subtitle1 fontWeight={600} mb={2} — section header
          Grid container spacing={2}
            Grid item xs={12} md={6} — form fields
        Section 2 — Paper variant="outlined" p={2.5}
          ...
```

Key rules:
- Each section (form, datagrid, etc.) **owns its own Paper** — no external wrappers
- Sections are stacked via flex column with `gap: 2.5`
- Form fields use `Grid item xs={12} md={6}` (2-column desktop, 1-column mobile)
- All fields: `fullWidth`, `autoComplete="off"` where appropriate
- Required fields: label ends with ` *` (e.g., "Nome ruolo *")

## Datagrid Section Pattern

When a datagrid is embedded in a detail page:

```
Paper variant="outlined" p={2.5}
  Box (flex, alignItems: center, justifyContent: space-between, mb: 2)
    Box
      Typography subtitle1 fontWeight={600} — section title
      Typography body2 color="text.secondary" — helper text
    Chip (selection counter, conditional)
  Datagrid
```

- Section header + helper text on the left
- Selection counter Chip on the right (shown only when `count > 0`)
- Counter uses `Chip size="small" color="primary" variant="outlined"`
- Column headers in Italian (e.g., "Vista" not "View")
- Boolean columns rendered as `Chip size="small" variant="outlined"` with `color="success"` for true, `color="default"` for false

## Form Components

- `FormikSearchbox` — search + select from existing records
- `FormikTextField` — standard text input
- `FormikCheckbox` — boolean toggle
- All connect to Formik state via `FastField` for performance
- Disabled state controlled by `form.status.isFormLocked`

## Language

- All UI labels, headers, helper texts in **Italian**
- Column headers in Italian
- Toast messages in Italian
