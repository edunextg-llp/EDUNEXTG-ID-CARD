# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are administrators and staff across educational institutions (school networks, colleges, and academies) as well as centralized print and platform managers:
- **School Admins & School Operators**: Manage student and staff records, upload rosters (Excel) and bulk photo archives (ZIP), design or select official templates, and submit print procurement orders.
- **Super Admins**: Govern platform-wide schools, provision credentials, design master canvas templates, approve/reject card batches, and oversee production pipelines.
- **Marketing Admins & Print Vendors**: Track order fulfillment statuses, accessory specifications (lanyards, PVC core/inkjet), and delivery schedules.

## Product Purpose

An enterprise-grade, multi-tenant student and staff identity lifecycle suite designed to unify canvas-based ID card design, batch data ingestion, photo matching, multi-stage approval workflows, cryptographic QR/barcode verification, and high-resolution PVC print production into a reliable web application.

## Positioning

Unlike generic card design software or fragmented spreadsheets, Insight Education provides an end-to-end institutional workflow: tenant-isolated school data, drag-and-drop dual-sided template designer, automated zip photo matching with client/server compression, strict multi-stage card status lifecycles (`DRAFT` → `SUBMITTED` → `APPROVED` → `PRINTED`), and direct print procurement order tracking.

## Operating Context

- High-density data tables and batch workflows (handling hundreds or thousands of student/staff records per intake).
- Interactive dual-sided canvas editors (CR80 standard card dimensions, portrait/landscape, custom layers).
- Real-world print factory requirements (PVC Inkjet / Core specifications, single/double sided, custom lanyard dimensions/colors).
- Desktop, tablet, and mobile usage with responsive drawers and contained table scrolling.

## Capabilities and Constraints

- **Stack**: React 19, TypeScript, Vite 7, Tailwind CSS v4, Radix UI, TanStack Query v5, Wouter, Express, Drizzle ORM, MySQL.
- **Verification & Formats**: Code128 barcodes, cryptographic QR codes, PDFKit export for CR80 PVC standards.
- **Data & Assets**: Magic-byte MIME type inspection, automated image compression (<100KB), Excel roster parsers, ZIP archive photo auto-matching.
- **Theming**: Zero-flash Light, Dark, and System appearance modes with dynamic theme-color synchronization.

## Brand Commitments

- **Product Name**: Insight Education · School ID Card Management Suite
- **Brand Identity**: EduNextG (Insight Education)
- **Voice**: Clean, professional, institutional, precise, and operationally robust.

## Evidence on Hand

- Complete running application codebase in `client/` and `server/`.
- Architectural and feature documentation in [README.md](./README.md).
- Relational schema in [drizzle/schema.ts](./drizzle/schema.ts).

## Product Principles

1. **Operational Precision & Restraint**: Priority on density, scanability, and high-throughput data tasks over decorative flourishes.
2. **Defensive Data Integrity**: Strict multi-tenant isolation, immutable audit trails, and deterministic card status lifecycles.
3. **Flawless Physical Print Fidelity**: Visual editor canvas and PDF exports must strictly match physical CR80 PVC card standards and vendor specs.
4. **Resilient Under Heavy Batch Loads**: Smooth handling of large rosters, bulk image extraction, and zero UI lockup during batch operations.

## Accessibility & Inclusion

- Responsive from 320px mobile to ultra-wide displays.
- High-contrast text readability across both Light and Dark themes.
- Accessible form controls and modals built upon Radix UI primitives.
