/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const axios = require("axios").default;
const _ = require("lodash");

import { env } from "vscode";
import * as keytarType from "keytar";

const state = require("./state");
const api = require("./api");

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
import { FileExplorer } from "./apps-provider";
import { DependencyExplorer } from "./dependencies";

const extensionId = "fliplet.vscode";

let statusBarItem: vscode.StatusBarItem;
let currentContext: vscode.ExtensionContext;
let tree: FileExplorer;
let dependenciesTree: DependencyExplorer;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  currentContext = context;

  tree = new FileExplorer(context);

  try {
    fs.mkdirSync(path.join(os.tmpdir(), "fliplet"));
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
        `${api.baseURL()}v1/auth/third-party?redirect=${encodeURIComponent(
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
    } else {
      api.create();
    }

    _.forIn(
      (await state.api.get("v1/widgets/assets")).data.assets,
      (value: any, name: string) => {
        if (value.reference) {
          value.name = name;
          state.dependencies.push(value);
        }
      }
    );

    state.dependencies = _.sortBy(state.dependencies, "name");

    dependenciesTree = new DependencyExplorer(context);

    vscode.commands.executeCommand("setContext", "hasDependencies", true);
  }
}

vscode.commands.registerCommand("apps.refresh", function () {
  fetchApps();
});

vscode.commands.registerCommand("apps.settings", async function () {
  const quickPick = vscode.window.createQuickPick();

  const items = [];

  if (currentContext.workspaceState.get("isImpersonating")) {
    items.push({
      label: "Unimpersonate from this user",
      detail: `Logs out from the current impersonating session`,
    });
  } else {
    items.push({
      label: "Log out from your account",
      detail: `You are currently logged in as ${state.user.email}`,
    });

    if (state.user.userRoleId === 1) {
      items.push({
        label: "Impersonate a different user",
        detail: `Impersonate another Fliplet Studio user`,
      });
    }
  }

  quickPick.items = items;

  quickPick.onDidChangeSelection(async ([{ label }]) => {
    quickPick.hide();

    if (label.indexOf("Log out") === 0) {
      logout();
    } else if (label.indexOf("Impersonate") === 0) {
      const users = (await state.api.get("v1/admin/users")).data.users;

      const usersPick = vscode.window.createQuickPick();

      usersPick.matchOnDescription = true;
      usersPick.matchOnDetail = true;

      usersPick.items = users.map((user: any) => {
        return {
          description: user.id.toString(),
          label: `$(accounts-view-bar-icon) ${_.compact([
            user.firstName,
            user.lastName,
          ]).join(" ")}`,
          detail: user.email,
        };
      });

      usersPick.onDidChangeSelection(async ([{ description }]) => {
        const userId = description;
        usersPick.hide();

        const data = (
          await state.api.post(`/v1/admin/users/${userId}/impersonate`)
        ).data;
        const authToken = data.session.auth_token;

        if (!keytar) {
          return;
        }

        const currentAuthToken: string | any = await keytar.getPassword(
          extensionId,
          "authToken"
        );

        if (currentAuthToken) {
          await keytar.setPassword(
            extensionId,
            "previousAuthToken",
            currentAuthToken
          );
        }

        currentContext.workspaceState.update("isImpersonating", true);

        state.apps = [];
        tree.refresh();

        await verify(authToken);
      });

      usersPick.show();
    } else if (label.indexOf("Unimpersonate") === 0) {
      await state.api.post("v1/auth/logout");

      currentContext.workspaceState.update("isImpersonating", false);

      if (keytar) {
        const previousAuthToken: string | any = await keytar.getPassword(
          extensionId,
          "previousAuthToken"
        );

        if (previousAuthToken) {
          await keytar.deletePassword(extensionId, "previousAuthToken");
          verify(previousAuthToken);
        } else {
          vscode.commands.executeCommand("setContext", "loggedIn", false);
        }
      }
    }
  });

  quickPick.show();
});

async function logout() {
  await state.api.post("v1/auth/logout");

  if (keytar) {
    keytar.deletePassword(extensionId, "authToken");
  }

  currentContext.workspaceState.update("isImpersonating", false);
  vscode.commands.executeCommand("setContext", "loggedIn", false);

  if (statusBarItem) {
    statusBarItem.hide();
  }

  vscode.window.showInformationMessage(
    "You have been logged out from your account."
  );

  state.user = {};

  api.restoreBaseUrl();

  vscode.workspace.textDocuments.forEach((document) => {
    if (document.fileName.indexOf(state.organization.name) !== -1) {
      // todo: close doc
    }
  });
}

vscode.commands.registerCommand("apps.logout", logout);

async function fetchApps() {
  const apps = (await state.api.get("v1/apps")).data.apps;

  apps.forEach((app: any) => {
    app.name = app.name.trim();
  });

  state.apps = _.sortBy(apps, "name");
  tree.refresh();
}

async function verify(authToken: string) {
  api.create(authToken);

  vscode.commands.executeCommand("setContext", "loggedIn", true);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
      title: "Fliplet",
    },
    async (progress) => {
      try {
        progress.report({ message: "Authenticating...", increment: 0 });

        const response = (await state.api.get("v1/user")).data;
        state.user = response.user;

        if (response.host && response.host !== api.baseURL()) {
          api.create(authToken, response.host);
        }

        progress.report({
          message: "Checking account and organization plan...",
          increment: 20,
        });

        state.organization = _.first(
          (await state.api.get("v1/organizations")).data.organizations
        );

        progress.report({ message: "Retrieving apps...", increment: 80 });

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
        currentContext.workspaceState.update("isImpersonating", false);
        console.error(err);
      }
    }
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
