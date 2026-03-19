# OrbitForge VS Code Support

## Community support

- GitHub issues: https://github.com/mehtarakesh/orbitforge-dev/issues
- Product site: https://orbitforge.dev

## Before filing an issue

Please include:

- OrbitForge extension version
- VS Code version
- provider
- model
- base URL
- whether the issue happens in `single` or `parallel` mode
- whether the issue reproduces with a starter blueprint

## Common setup checks

- Confirm your provider endpoint is reachable.
- Confirm your API key is set when using hosted providers.
- For Ollama, confirm the model is installed locally.
- For JSON blueprints, confirm the file contains `blueprintId`, `title`, `summary`, `goal`, and `nodes`.
