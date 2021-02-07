/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const axios = require("axios").default;
const _ = require("lodash");

import { env } from "vscode";
import * as keytarType from "keytar";

declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;

function getNodeModule<T>(moduleName: string): T | undefined {
  const r =
    typeof __webpack_require__ === "function"
      ? __non_webpack_require__
      : require;
  try {
    return r(`${env.appRoot}/node_modules.asar/${moduleName}`);
  } catch (err) {
    // Not in ASAR.
  }
  try {
    return r(`${env.appRoot}/node_modules/${moduleName}`);
  } catch (err) {
    // Not available.
  }
  return undefined;
}

const keytar = getNodeModule<typeof keytarType>("keytar");
import { AppsProvider, FileExplorer } from "./apps-provider";

const extensionId = "fliplet.vscode";

let statusBarItem: vscode.StatusBarItem;

const state = require("./state");

let tree: FileExplorer;

const baseURL = "https://api.fliplet.test/";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  tree = new FileExplorer(context);

  try {
    fs.mkdirSync(path.join(os.tmpdir(), 'fliplet'));
  } catch (err) {
    vscode.window.showErrorMessage(err);
  }

  // Register a URI handler for the authentication callback
  vscode.window.registerUriHandler({
    handleUri: function (uri) {
      // Add your code for what to do when the authentication completes here.
      if (uri.path.indexOf("/auth-complete") === 0) {
        const authToken = uri.query.replace("auth_token=", "") as string;

        return verify(authToken);
      }
    },
  });

  let disposable = vscode.commands.registerCommand(
    "fliplet.signin",
    async function () {
      const callbackUri = await vscode.env.asExternalUri(
        vscode.Uri.parse(
          `${vscode.env.uriScheme}://${extensionId}/auth-complete`
        )
      );

      const uri = vscode.Uri.parse(
        `${baseURL}v1/auth/third-party?redirect=${encodeURIComponent(
          callbackUri.toString()
        )}&responseType=code&source=VSCode&title=Sign%20in%20to%20Authorize%20Visual%20Studio%20Code`
      );

      vscode.env.openExternal(uri);
    }
  );

  context.subscriptions.push(disposable);

  if (keytar) {
    const authToken: string | null = await keytar.getPassword(
      extensionId,
      "authToken"
    );

    if (authToken) {
      verify(authToken);
    }
  }
}

vscode.commands.registerCommand("apps.refresh", function () {
  fetchApps();
});

vscode.commands.registerCommand("apps.settings", async function () {
  const quickPick = vscode.window.createQuickPick();

  quickPick.items = [
    {
      label: "Log out from your account",
      detail: `You are currently logged in as ${state.user.email}`,
    },
  ];

  quickPick.onDidChangeSelection(([{ label }]) => {
    if (label.indexOf("Log out") === 0) {
      logout();
    }

    quickPick.hide();
  });
  quickPick.show();
});

async function logout() {
  await state.api.post("v1/auth/logout");

  if (keytar) {
    keytar.deletePassword(extensionId, "authToken");
  }

  vscode.commands.executeCommand("setContext", "loggedIn", false);

  if (statusBarItem) {
    statusBarItem.hide();
  }

  vscode.window.showInformationMessage(
    "You have been logged out from your account."
  );

  state.user = {};

  vscode.workspace.textDocuments.forEach((document) => {
    if (document.fileName.indexOf(state.organization.name) !== -1) {

    }
  });
}

vscode.commands.registerCommand("apps.logout", logout);

async function fetchApps() {
  const apps = (await state.api.get("v1/apps")).data.apps;

  state.apps = apps;
  tree.refresh();
}

async function verify(authToken: string) {
  state.api = axios.create({
    baseURL: "https://api.fliplet.test/",
    headers: { "Auth-token": authToken, "X-Third-Party": extensionId },
  });

  vscode.commands.executeCommand("setContext", "loggedIn", true);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
      title: "Fliplet",
    },
    async (progress) => {
    try {
      progress.report({ message: 'Authenticating...', increment: 40 });

      state.user = (await state.api.get("v1/user")).data.user;

      progress.report({ message: 'Checking license...', increment: 40 });

      state.organization = _.first(
        (await state.api.get("v1/organizations")).data.organizations
      );

      progress.report({ message: 'Retrieving Apps...', increment: 80 });

      if (keytar) {
        await keytar.setPassword(extensionId, "authToken", authToken);
      }

      if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(
          vscode.StatusBarAlignment.Left,
          1000
        );
      }

      statusBarItem.text = `${state.user.fullName} (${state.organization.name})`;
      //statusBarItem.command = 'extension.sayHello';
      statusBarItem.show();

      await fetchApps();
    } catch (err) {
      vscode.commands.executeCommand("setContext", "loggedIn", false);
      console.error(err);
    }
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
