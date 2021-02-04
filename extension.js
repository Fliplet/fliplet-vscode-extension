// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");

const axios = require("axios").default;
const _ = require("lodash");
const keytar = require("keytar");

const extensionId = "fliplet.vscode";

const { Tree } = require("./tree");

let API;
let statusBarItem;

const state = {
  apps: []
};

const baseURL = "https://api.fliplet.test/";

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Register a URI handler for the authentication callback
  vscode.window.registerUriHandler({
    handleUri: function (uri) {
      // Add your code for what to do when the authentication completes here.
      if (uri.path.indexOf("/auth-complete") === 0) {
        const authToken = uri.query.replace("auth_token=", "");

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

  keytar.getPassword(extensionId, "authToken").then(function (authToken) {
    if (authToken) {
      verify(authToken);
    }
  });
}

// this method is called when your extension is deactivated
function deactivate() {

}

async function verify(authToken) {
  /*return vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    cancellable: false,
    title: 'Fliplet'
	}).then(async (progress) => {
  */

 vscode.commands.executeCommand("setContext", "loggedIn", true);

  API = axios.create({
    baseURL: "https://api.fliplet.test/",
    headers: { "Auth-token": authToken, "X-Third-Party": extensionId },
  });

  const tree = new Tree({
    state,
    API,
  });

  vscode.window.registerTreeDataProvider("apps", tree);
  vscode.commands.registerCommand("apps.refresh", function () {
    tree.refresh();
  });

  vscode.commands.registerCommand("apps.logout", async function () {
    await API.post("v1/auth/logout");

    keytar.deletePassword(extensionId, 'authToken');
    vscode.commands.executeCommand("setContext", "loggedIn", false);

    if (statusBarItem) {
      statusBarItem.hide();
    }
  });

  try {
    const user = (await API.get("v1/user")).data.user;
    const organization = _.first(
      (await API.get("v1/organizations")).data.organizations
    );

    await keytar.setPassword(extensionId, "authToken", authToken);

    if (!statusBarItem) {
      statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        1000
      );
    }

    statusBarItem.text = `${user.fullName} (${organization.name})`;
    //statusBarItem.command = 'extension.sayHello';
    statusBarItem.show();

    const apps = (await API.get("v1/apps")).data.apps;

    state.apps = apps;
    //tree.refresh();
  } catch (err) {
    vscode.commands.executeCommand("setContext", "loggedIn", false);
    console.error(err);
  }
}

module.exports = {
  activate,
  deactivate,
};
