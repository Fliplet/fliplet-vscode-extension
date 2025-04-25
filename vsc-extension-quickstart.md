# Fliplet Developer Tools - VS Code Extension Development Guide

## What's in the folder

* This folder contains all of the files necessary for the Fliplet VSCode extension.
* `package.json` - This is the manifest file that defines the extension metadata, commands, and required contribution points.
* `src/extension.ts` - The main entry point of the extension where the activation function is defined.
* `src/apps-provider.ts` - Implements the TreeDataProvider and FileSystemProvider for browsing Fliplet apps, pages, and components.
* `src/dependencies.ts` - Implements the TreeDataProvider for browsing Fliplet libraries and dependencies.
* `src/api.js` - Contains the API client for communicating with Fliplet's API.
* `src/state.js` - Manages the global state of the extension.

## Development Setup

* Clone the repository: `git clone https://github.com/Fliplet/fliplet-vscode-extension.git`
* Run `npm install` to install dependencies
* Press `F5` to open a new window with your extension loaded.
* You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.
* Run `npm run watch` in a terminal to compile changes automatically.

## Testing the Extension

* Set breakpoints in your code inside `src/extension.ts` to debug your extension.
* Find output from your extension in the debug console.
* The extension should create a new sidebar icon with the Fliplet logo.
* Login with your Fliplet Studio credentials to test the extension features.

## Key Features to Test

1. Authentication and login flow
2. Browsing apps, pages, and components
3. Previewing pages
4. Configuring and editing components
5. Managing data sources
6. Browsing Fliplet libraries

## Making Changes

* The extension uses TypeScript for type safety.
* When adding new features, follow the existing patterns in the codebase.
* Avoid using jQuery in new code; use native DOM methods instead.
* Use modern JavaScript syntax (async/await instead of promise chains).
* Document your code with JSDoc comments.

## Packaging and Publishing

1. Install vsce: `npm install -g vsce`
2. Increase the version number in `package.json`
3. Package the extension: `vsce package`
4. Publish the extension: `vsce publish`
5. Or upload manually via the UI at https://marketplace.visualstudio.com/manage/publishers/fliplet

## Additional Resources

* [VS Code Extension API](https://code.visualstudio.com/api)
* [Fliplet Developer Documentation](https://developers.fliplet.com/)
* [Bundling Extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)
* [Publishing Extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
* [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)
