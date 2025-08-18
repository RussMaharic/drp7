Title: drp5 – Product Requirements Document (PRD)

Summary
- drp5 is a Next.js 15 + React 19 web application that integrates with Shopify to orchestrate multi-store e-commerce operations. It connects stores, ingests and syncs orders and products, enables role-based management for admins, sellers, and suppliers, and provides delivery tracking and analytics.

Primary Users
- Admin: Oversees platform setup, store onboarding, global settings, and data health.
- Seller/Merchant: Connects their Shopify store, reviews analytics, manages orders, and store configurations.
- Supplier/Fulfillment Partner: Views and fulfills assigned orders, updates shipment status, and manages product availability.

Goals and Non-Goals
- Goals:
  - Connect Shopify stores and securely authenticate access.
  - Ingest orders and products via webhook/API and persist in a Postgres database.
  - Sync order status and product updates between Shopify and the app.
  - Provide dashboards for orders, delivery tracking, and analytics.
  - Support pushing products and updates back to Shopify.
- Non-Goals (for now):
  - Built-in payment processing beyond what Shopify provides.
  - Marketplace discovery or consumer-facing storefront.

Key Features
- Shopify integration:
  - OAuth connection and token management for stores.
  - Webhooks and polling endpoints to ingest orders and updates.
  - API endpoints to read/write products and orders (push-to-shopify, shopify-products, shopify-orders, shopify-webhook, shopify-direct-orders, shopify-orders-graphql).
- Order management:
  - Unified order list with role-based views (admin, seller, supplier).
  - Order detail, status updates, cancellation, and syncing (app/api/orders/[id]).
  - Supplier order queue and actions (app/supplier/orders).
- Tracking and delivery:
  - Shipment tracking ingestion and status views (app/api/tracking, dashboard/delivery).
  - Database support for tracking fields (migrations/add-order-tracking.sql).
- Analytics and dashboards:
  - Overview, stores, orders, delivery, and analytics pages (app/dashboard/*).
  - Charts and KPIs for operational insight.
- Store management:
  - Connect-store and connect-shopify flows.
  - Store configuration model (lib/types/store-config.ts, lib/services/store-manager.ts, seller-store-service.ts).
- Authentication and roles:
  - Login flows for admin, seller, and supplier with protected routes (middleware, app/auth/*).

High-Level Workflows
- Store onboarding:
  1) Seller initiates connect-shopify/connect-store.
  2) OAuth completes, tokens stored; store metadata persisted.
  3) Webhooks registered to receive orders and updates.
- Order ingestion and sync:
  1) Shopify sends webhooks or is queried by sync endpoints.
  2) Orders normalized and stored; assignments to suppliers created if applicable.
  3) Status updates mirrored back to Shopify as needed.
- Fulfillment and tracking:
  1) Supplier views assigned orders, updates status and tracking numbers.
  2) Tracking updates surface in dashboards and can be pushed to Shopify/customer.
- Analytics:
  1) Aggregations and metrics displayed in dashboard/analytics and delivery pages.

APIs and Pages (illustrative)
- API routes: app/api/
  - shopify-webhook, shopify-orders, shopify-orders-graphql, shopify-direct-orders, shopify-products, push-to-shopify, stores, tracking, sync-orders, supplier/orders, orders/[id], orders/[id]/cancel
- Pages and layouts: app/
  - dashboard/(analytics, delivery, orders, stores), admin, supplier, auth/(login, seller/supplier login+signup), connect-shopify, connect-store

Data Model and Storage
- Postgres (Neon/Vercel Postgres) used for persistence.
- Migrations include add-order-tracking.sql and add-customer-phone.sql indicating order-centric schema with tracking and customer contact fields.
- Token and store configuration services manage credentials and settings (lib/token-manager.ts, lib/services/*, lib/types/store-config.ts).

Assumptions and Constraints
- Shopify is the primary commerce platform target.
- Next.js 15, React 19, Tailwind, and Radix UI are used for the frontend.
- Serverless-friendly database access (Neon/@vercel/postgres) and API routes under app/api.
- Image optimization disabled and ESLint/TS build errors ignored in next.config.mjs (tradeoff: faster builds vs. stricter safety).

Success Metrics (examples)
- Time-to-onboard a store (successful OAuth + webhook registration).
- Order ingestion latency and success rate.
- Sync accuracy between Shopify and internal DB (mismatch rate).
- Fulfillment lead time and on-time delivery rate.
- Dashboard adoption (active users by role).

Risks and Mitigations
- API quota and webhook reliability: Implement backoff, retries, and dead-letter handling for sync-orders.
- Data consistency: Idempotency keys and upserts for orders/products.
- Multi-tenant security: Strict scoping by store and role-based access controls.
- PII handling: Limit exposure and follow least-privilege patterns.

Open Questions
- Which carriers and tracking providers are supported beyond basic tracking fields?
- How are suppliers assigned to orders (rules, manual, or auto-routing)?
- Are there SLAs for sync intervals and webhook processing time?

Appendix: Code Pointers
- Shopify APIs: app/api/shopify-*, lib/services/shopify-direct-client.ts
- Orders: app/api/orders/*, app/dashboard/orders/page.tsx
- Tracking: app/api/tracking/route.ts, app/dashboard/delivery/page.tsx, migrations/add-order-tracking.sql
- Stores: app/api/stores/*, connect-store, connect-shopify, lib/services/store-manager.ts
- Auth/Roles: app/auth/*, middleware.ts

