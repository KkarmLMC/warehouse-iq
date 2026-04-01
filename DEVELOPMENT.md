# Warehouse IQ — Developer Documentation

> Complete technical reference for the Warehouse IQ codebase. Last updated March 2026.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository & Deployment](#3-repository--deployment)
4. [Project Structure](#4-project-structure)
5. [Architecture Overview](#5-architecture-overview)
6. [Routing](#6-routing)
7. [Design System](#7-design-system)
8. [Component Library](#8-component-library)
9. [Database Tables](#9-database-tables)
10. [SO Pipeline Lifecycle](#10-so-pipeline-lifecycle)
11. [Floor Mode](#11-floor-mode)
12. [Cross-App Integration](#12-cross-app-integration)
13. [Role System](#13-role-system)
14. [Standards & Conventions](#14-standards--conventions)

---

## 1. Project Overview

**Warehouse IQ** is the warehouse operations platform for Lightning Master Corporation. It manages multi-warehouse inventory, the full SO fulfillment pipeline (including drop ship and back order parallel tracks), and shipment processing.

**Users:**
- **Warehouse manager** — runs orders, audits inventory, processes shipments and drop ships
- **Fulfillment workers** — pull parts per fulfillment sheets (floor mode)
- **Shipping workers** — pack and ship orders (floor mode)
- **Admin** — user management, full access

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 19 |
| Routing | React Router DOM | 7 |
| Build Tool | Vite | 8 |
| Backend / DB | Supabase (Postgres + Storage) | 2 |
| Icons | Phosphor Icons | 2 |
| Deployment | Vercel | — |
| Styling | Plain CSS + CSS Custom Properties | — |

---

## 3. Repository & Deployment

| Item | Value |
|---|---|
| **Repo** | github.com/KkarmLMC/warehouse-iq |
| **Vercel project** | warehouse-iq |
| **Vercel team** | team_oKaol6h5RgP01y9JBHaQtnzG |
| **Production URL** | warehouse-iq.vercel.app |
| **Supabase project** | jnbdlhyjnzdsvscpgkqi |

---

## 4. Project Structure

```
src/
├── App.jsx                    # Root — routing, layout shell, headers
├── main.jsx                   # Entry point
├── components/
│   ├── Sidebar.jsx            # Config wrapper (delegates to shared Sidebar)
│   ├── BottomNav.jsx          # Mobile bottom nav
│   ├── PageSubNav.jsx         # Horizontal sub-navigation
│   ├── ProjectPicker.jsx      # Project selector
│   └── ui/                    # Shared UI kit (synced across all 3 apps)
│       ├── index.js           # Barrel export
│       ├── primitives/        # Button, Input, Badge, Spinner...
│       ├── navigation/        # Sidebar (renderer), PageHeader, BottomNav...
│       ├── data-display/      # Card, StatCard, RowItem, StatusBadge...
│       ├── foundations/       # Surface
│       └── workflows/         # ActionButton, FilterPills
├── lib/
│   ├── supabase.js            # Supabase client
│   ├── statusColors.js        # Shared status color/label resolver
│   ├── logActivity.js         # Activity logging utility
│   ├── useAuth.jsx            # Auth hook (session, profile, PIN)
│   └── useRole.js             # Role-based access hook
├── pages/                     # All route pages (23 pages)
└── styles/
    ├── globals.css             # Full design system + app CSS + utilities
    └── ui-kit-components.css   # Shared UI kit supplementary styles
```

---

## 5. Architecture Overview

WIQ is a single-page app sharing the Supabase backend with MC and FO.

**Key patterns:**
- **Config-only Sidebar** — local Sidebar.jsx passes nav items (with floor mode logic), footer, clock, and collapse icons to the shared renderer
- **Floor mode** — pipeline workers (fulfillment, shipping, warehouse_manager) can toggle to a simplified nav showing only their queue
- **App.jsx has zero structural inline styles**
- **Parallel fulfillment tracks** — an SO can split into warehouse fulfillment + drop ship + back order, each running independently

---

## 6. Routing

### Main routes
| Route | Page |
|---|---|
| `/warehouse-hq` | Inventory (dashboard) |
| `/warehouse-hq/iq` | WarehouseIQ (analytics) |
| `/warehouse-hq/inventory` | InventoryStock |
| `/warehouse-hq/catalog` | PartsCatalog |
| `/warehouse-hq/transfer` | InventoryTransfer |
| `/warehouse-hq/warehouse/:id` | WarehouseDetail |
| `/warehouse-hq/part/:id` | PartDetail |
| `/warehouse-hq/add-part` | AddEditPart |

### SO Pipeline routes
| Route | Page |
|---|---|
| `/warehouse-hq/queue` | SOQueue |
| `/warehouse-hq/queue/:id` | RunOrder |
| `/warehouse-hq/fulfillment` | FulfillmentQueue |
| `/warehouse-hq/fulfillment/:id` | FulfillmentDetail |
| `/warehouse-hq/shipment` | ShipmentQueue |
| `/warehouse-hq/shipment/:id` | ShipmentDetail |
| `/warehouse-hq/dropship` | DropShipQueue |
| `/warehouse-hq/dropship/:id` | DropShipDetail |
| `/warehouse-hq/backorder` | BackorderQueue |

### Sales order routes
| Route | Page |
|---|---|
| `/sales-orders` | PurchaseOrders |
| `/sales-orders/new` | PONew |
| `/sales-orders/:id` | PODetail |

---

## 7. Design System

See `DESIGN_SYSTEM.md` for the full spec. Key points:
- **3-layer token architecture:** Foundation → Semantic → Component
- **Flat UI** — no box-shadow anywhere
- **BEM naming** — `.block__element--modifier`
- **Utility classes** — `u-*` prefix for common patterns (u-w-full, u-flex, u-mb-l)

---

## 8. Component Library

### Shared UI Kit
Import from barrel: `import { Card, Button, Badge } from '../components/ui'`

Identical across all 3 apps — 33 components in 5 categories.

### App-Specific Components
| Component | Purpose |
|---|---|
| Sidebar.jsx | Config wrapper — nav items with floor mode, clock |
| BottomNav.jsx | Mobile bottom navigation |
| PageSubNav.jsx | Horizontal sub-nav for warehouse sections |
| ProjectPicker.jsx | Project selector dropdown |

---

## 9. Database Tables

Primary tables used by WIQ:

| Table | Usage |
|---|---|
| `sales_orders` | SO lifecycle, status, flags (has_back_order, has_drop_ship) |
| `so_line_items` | SO line items with parts reference |
| `fulfillment_sheets` | One sheet per SO — links to fulfillment_lines |
| `fulfillment_lines` | Per-line audit: qty, warehouse, splits, back order, drop ship |
| `shipments` | Shipment records (type: warehouse or dropship) |
| `warehouses` | Warehouse locations |
| `inventory_levels` | Stock per part per warehouse |
| `parts` | Parts catalog |
| `profiles` | User profiles, roles, PIN hashes |

---

## 10. SO Pipeline Lifecycle

```
SO Queue → Run Order → Fulfillment → Shipment → Complete
                     ↘ Drop Ship Queue (PLP) ↗
                     ↘ Back Order Queue      ↗
```

**Compound statuses:** `partial_fulfillment`, `partial_shipment`
**SO flags:** `has_back_order`, `has_drop_ship`

The SO only reaches `complete` when all parallel tracks are resolved.

**Run Order** is where the manager decides per shortage line:
- "Wait for restock" → back order queue
- "Drop ship from PLP" → drop ship queue
- Lines with stock → normal fulfillment

---

## 11. Floor Mode

Pipeline workers can toggle between full app navigation and a simplified floor-mode view showing only their queue:

| `pipeline_role` | Floor mode shows |
|---|---|
| `fulfillment` | Fulfillment Queue only |
| `shipping` | Shipment Queue only |
| `warehouse_manager` | Dashboard, SO Queue, Inventory |

Toggle state persists per device via localStorage.

---

## 12. Cross-App Integration

| From | To | Mechanism |
|---|---|---|
| MC creates SO | WIQ SO Queue | Shared `sales_orders` table |
| WIQ ships order | FO project detail | Shared `shipments` table |
| WIQ processes drop ship | FO deliveries section | Shared `shipments` (type=dropship) |

---

## 13. Role System

| Role | Access |
|---|---|
| `admin` | Full access + user management |
| `warehouse_manager` | Full warehouse access |
| `fulfillment` | Fulfillment queue only (floor mode) |
| `shipping` | Shipment queue only (floor mode) |

---

## 14. Standards & Conventions

See `STANDARDS.md` for the full spec. Summary:
- **No structural inline styles** — use BEM classes or u-* utilities
- **No raw hex values** — use semantic tokens
- **No box-shadow** — flat UI only
- **Build before push** — `npx vite build` must pass
- **Shared UI kit is canonical** — import from `../components/ui`
