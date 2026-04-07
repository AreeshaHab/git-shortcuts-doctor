# Publishing Checklist

Before publishing this extension to the Visual Studio Marketplace:

1. Replace the `publisher` field in `package.json` with your real Marketplace publisher ID.
2. Add real `repository`, `homepage`, and `bugs` URLs in `package.json`.
3. Review the icon in `media/icon.png` and replace it if you want branded artwork.
4. Update the copyright line in `LICENSE`.
5. Bump the version in `package.json`.
6. Run:
   - `npm install -g @vscode/vsce`
   - `vsce package`
   - `vsce publish`

For local testing without publishing:

1. Run `vsce package`
2. In VS Code, choose `Extensions: Install from VSIX...`
