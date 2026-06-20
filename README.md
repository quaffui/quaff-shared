# Quaff Shared

Shared install-flow tests for Quaff releases.

The runner creates a fresh project through the real `create-quaff` CLI, installs dependencies,
runs type checks, starts the dev server, verifies the rendered page in Chromium, builds the app,
starts the preview server, and verifies the rendered page again.

## Local Usage

Test the latest npm packages:

```sh
bun run e2e
```

Test a local Quaff checkout with npm `create-quaff`:

```sh
bun run e2e -- --quaff-source ../quaff
```

Test a local create-quaff checkout with npm Quaff:

```sh
bun run e2e -- --create-quaff-source ../create-quaff
```

Keep the generated app for inspection:

```sh
bun run e2e -- --quaff-source ../quaff --keep
```

Run the browser headed for local debugging:

```sh
bun run e2e -- --headed --keep
```

## Reusable Workflow

Quaff PRs can call `.github/workflows/generated-project-e2e.yml` with:

```yaml
with:
  package-under-test: quaff
  source-repository: ${{ github.event.pull_request.head.repo.full_name }}
  source-ref: ${{ github.event.pull_request.head.sha }}
```

create-quaff PRs can call it with:

```yaml
with:
  package-under-test: create-quaff
  source-repository: ${{ github.event.pull_request.head.repo.full_name }}
  source-ref: ${{ github.event.pull_request.head.sha }}
```

Post-publish workflows can test the latest npm packages with:

```yaml
with:
  package-under-test: published
```
