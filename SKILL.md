# Warehouse IQ — Project Brief

## What This Is
The warehouse operations platform for Bolt Lightning Protection (Lightning Master Corporation, Clearwater FL).
Manages inventory across multiple warehouses, sales order fulfillment pipeline, shipment processing, drop ship management, and back order tracking.

---

## Current State (as of March 2026)

### What exists and works:
- Full Vite + React Router SPA deployed on Vercel
- Supabase auth with PIN verification
- Multi-warehouse inventory management (Clearwater HQ, Midland TX, Dallas TX, Florida)
- Parts catalog with categories, stock levels, reorder points
- Sales order pipeline: SO Queue → Run Order → Fulfillment → Shipment
- Drop Ship Queue (PLP supplier) with carrier/tracking/PO entry
- Back Order Queue with days-waiting escalation
- Run Order inventory audit with per-line shortage decisions (back order vs drop ship)
- Compound SO statuses (partial_fulfillment, partial_shipment)
- Purchase order creation with line items
- Floor mode for pipeline workers (fulfillment, shipping roles)
- Inventory transfers between warehouses
- User management (admin only)

### Cross-app integration:
- Sales orders created in Mission Control flow here for fulfillment
- Shipment data (warehouse + drop ship) surfaces in Field Ops project detail
- Shared Supabase backend with all 3 apps

---

## Stack
- **Framework:** React 19 + Vite 8
- **Routing:** React Router 7
- **Styling:** CSS custom properties + BEM (globals.css)
- **Icons:** Phosphor Icons (ONLY icon library)
- **Backend:** Supabase JS 2 (project: jnbdlhyjnzdsvscpgkqi)
- **Deployment:** Vercel (project: warehouse-iq, team: team_oKaol6h5RgP01y9JBHaQtnzG)
- **Repo:** github.com/KkarmLMC/warehouse-iq

---

## Key Routes
| Route | Page | Purpose |
|---|---|---|
| /warehouse-hq | Inventory | Dashboard with warehouse cards + active SOs |
| /warehouse-hq/iq | WarehouseIQ | Analytics dashboard |
| /warehouse-hq/inventory | InventoryStock | Stock levels across warehouses |
| /warehouse-hq/catalog | PartsCatalog | Full parts list |
| /warehouse-hq/transfer | InventoryTransfer | Transfer stock between locations |
| /warehouse-hq/queue | SOQueue | Sales order queue |
| /warehouse-hq/queue/:id | RunOrder | Inventory audit + fulfillment push |
| /warehouse-hq/fulfillment | FulfillmentQueue | Orders being pulled |
| /warehouse-hq/fulfillment/:id | FulfillmentDetail | Confirm pulled items |
| /warehouse-hq/shipment | ShipmentQueue | Orders ready to ship |
| /warehouse-hq/shipment/:id | ShipmentDetail | Enter carrier/tracking |
| /warehouse-hq/dropship | DropShipQueue | PLP drop ship queue |
| /warehouse-hq/dropship/:id | DropShipDetail | Enter PLP tracking info |
| /warehouse-hq/backorder | BackorderQueue | Items awaiting restock |
| /sales-orders | PurchaseOrders | SO list view |
| /sales-orders/new | PONew | Create new SO |
| /sales-orders/:id | PODetail | SO detail |

---

## Design Rules
- 100% flat UI — no box-shadow anywhere
- Use semantic tokens (--text-primary, --surface-base) not raw hex
- BEM class naming — no structural inline styles
- All styles in globals.css — no CSS modules, no Tailwind
- Shared UI kit synced across all 3 apps
