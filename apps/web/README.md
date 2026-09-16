# Enterprise Next.js 16 Starter Platform

Production-ready, highly extensible boilerplate equipped with a custom HeroUI abstraction layer, dynamic forms generator, URL synced enterprise table system, S3/Cloudinary upload adaptor interface, and custom middleware authorization filters.

## Core Stack
- **Framework**: Next.js 16 (App Router, Server Components)
- **Styling**: Tailwind CSS + Custom HSL variable themes
- **UI Abstraction**: HeroUI wrapping wrappers under `src/components/ui/`
- **Forms**: React Hook Form + Zod automatic validations
- **Tables**: TanStack Table with automatic search parameters synchronization
- **Queries**: TanStack Query
- **State**: Zustand client state store

---

## Folder Structure

```
src/
 ├── app/              # Next.js pages & router layouts
 ├── features/         # Domain business features (e.g., users)
 │    ├── components/
 │    ├── hooks/
 │    ├── schemas/
 │    └── services/
 ├── components/       # Cross-cutting reusable items
 │    ├── ui/          # Generic HeroUI wrappers (Button, Input, Select, Modal, etc.)
 │    ├── forms/       # DynamicForm engine
 │    └── table/       # MasterTable component
 ├── lib/              # Core API configurations, auth store, uploads
 └── hooks/            # Global custom React hooks
```

---

## Getting Started

1. Install all dependencies:
   ```bash
   npm install
   ```

2. Copy the sample environment configurations:
   ```bash
   cp .env.example .env.local
   ```

3. Launch development workspace:
   ```bash
   npm run dev
   ```

## Creating Domain Features

To create a new domain feature, encapsulate everything inside a single feature namespace directory inside `src/features/` matching the target resource pattern.

For example, to create a `products` feature:
1. Define validations and interfaces in `src/features/products/schemas/index.ts`
2. Create API endpoint queries in `src/features/products/services/index.ts`
3. Implement customized components and hooks locally within the feature folders.
