# App Researcher

App Researcher is a local web app for researching owned Android packages. It
uploads APK and XAPK files, extracts static app metadata, keeps artifacts in
local storage, and provides package-level inspection views.

## Workspace

This repository is a pnpm monorepo:

- `apps/web` - Next.js App Router web application.
- `packages/ui` - shared shadcn/ui-based components and global styles.
- `packages/eslint-config` - shared ESLint configuration.
- `packages/typescript-config` - shared TypeScript configuration.

## Requirements

- Node.js 20 or newer.
- pnpm 10.
- Android SDK Build Tools with `aapt2` and `apksigner` available.

## Configuration

Copy `apps/web/.env.example` to `apps/web/.env.local` and adjust paths for your
machine.

Important defaults:

- `APK_RESEARCHER_DB_PATH=./.data/app-researcher.sqlite`
- `APK_RESEARCHER_STORAGE_DIR=./.data`
- `APK_RESEARCHER_MAX_UPLOAD_MB=200`
- `APK_RESEARCHER_ANALYSIS_TIMEOUT_MS=30000`

Set `APK_RESEARCHER_AAPT2_PATH` and `APK_RESEARCHER_APKSIGNER_PATH` to your
Android SDK Build Tools binaries if they are not available on `PATH`.

## Development

Install dependencies:

```bash
pnpm install
```

Run database migrations:

```bash
pnpm db:migrate
```

Start the web app:

```bash
pnpm dev
```

## Scripts

- `pnpm dev` - start all development servers through Turborepo.
- `pnpm build` - build the workspace.
- `pnpm test` - run tests.
- `pnpm lint` - run linting.
- `pnpm typecheck` - run TypeScript checks.
- `pnpm db:migrate` - apply Drizzle migrations for the web app.

## Supported Uploads

App Researcher accepts `.apk` and `.xapk` files. Other Android bundle formats
such as `.apks`, `.apkm`, and `.aab` are rejected in the current MVP.
