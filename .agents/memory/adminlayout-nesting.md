---
name: AdminLayout nesting-aware
description: AdminLayout dedupes chrome when nested; only nested Tabs cause real tabs-inside-tabs problems
---
AdminLayout reads an `AdminLayoutMounted` React context: if already mounted (a parent page already rendered AdminLayout), the inner AdminLayout renders only `{children}` — no second sidebar/header.

**Why:** lets tabbed hub pages (e.g. MyGrowth `/admin/growth`) embed full standalone page components (which each wrap AdminLayout) without double chrome.

**How to apply:** when flattening "tabs-inside-tabs", you do NOT need to strip nested AdminLayout from embedded pages — it is benign. The only thing that creates a real nested-tab UI is a child's own `<Tabs>`. Fix those (convert inner status Tabs to in-page button filters, or render the page's layout-free `*Content` export instead of the wrapper). Performance pages expose `MyGoalsContent`/`TeamGoalsContent`/`MyReviewsContent`/`TeamReviewsContent` for exactly this.
