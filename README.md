# Fliplet Developer Tools - Visual Studio Code Extension

**First-party extension to manage your Fliplet apps using your favourite code editor.**

This extension adds a new sidebar icon where you can log in with your Fliplet Studio account and edit your apps.

## Features

- Browse your Fliplet apps directly within VS Code
- Manage pages and components
- Preview pages and components in real-time
- Configure components
- Manage Data Sources
- Browse Fliplet libraries and dependencies
- Support for impersonation (for admin users)

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X on Mac)
3. Search for "Fliplet Developer Tools"
4. Click Install

### Manual Installation
1. Build the project
2. Open command pallete in VS Code
3. type `>install` and select `Developer: Install extension from location`
4. Select the repository directory

## Usage

1. After installation, click the Fliplet icon in the Activity Bar
2. Sign in with your Fliplet Studio account
3. Browse your apps, pages, and components
4. Use the context menu options to preview, configure, or edit items

## Development

1. Clone the repository
2. Run `npm install` to install dependencies
3. Press F5 to run the extension in development mode

## Update the extension

1. Install vsce `npm install -g vsce`
2. Increase version on `package.json` file
3. Run `vsce publish` to package the version as a new vsix file
4. Upload the version via the UI at https://marketplace.visualstudio.com/manage/publishers/fliplet

---

### Future support for web

- Follow requirements in https://code.visualstudio.com/api/extension-guides/web-extensions
- Change FS usage to https://code.visualstudio.com/api/references/vscode-api#FileSystemProvider or https://github.com/jvilk/BrowserFS