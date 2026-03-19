# VS Code Marketplace Release

This repo is ready for Marketplace and Open VSX publishing, but the first release still requires your publisher credentials.

## What is already done

- extension metadata is set up in `apps/orbitforge-vscode/package.json`
- branding assets are bundled in `apps/orbitforge-vscode/assets/`
- packaging works through `npm run package:extension`
- GitHub workflows can build and publish once secrets are configured

## Create your publisher

1. Create a Visual Studio Marketplace publisher.
2. Use the publisher identifier you actually own.
3. If it differs from `mehtarakesh`, update the `publisher` field in `apps/orbitforge-vscode/package.json` before first publish.

## Create a Marketplace PAT

Create a Personal Access Token with Marketplace publish permissions, then store it as:

- `VSCE_PAT`

## Optional: Open VSX

To publish for Open VSX and compatible editors, create an Open VSX token and store it as:

- `OVSX_PAT`

## Local publish flow

```bash
npm install
npm run build:extension
npm run package:extension
cd apps/orbitforge-vscode
npx vsce publish --no-dependencies
```

## GitHub Actions publish flow

The repo includes `.github/workflows/extension-release.yml`.

Set these secrets:

- `VSCE_PAT`
- `OVSX_PAT` (optional)

Then either:

- run the workflow manually
- or publish from a version tag once you choose a release convention

## Install after publish

Users will be able to install OrbitForge by:

- searching for `OrbitForge` in VS Code
- or running:

```bash
code --install-extension mehtarakesh.orbitforge-vscode
```

If your publisher identifier changes, the install command changes with it.
