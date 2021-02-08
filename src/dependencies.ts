import * as vscode from "vscode";

const _ = require("lodash");
const state = require("./state");

export class DependencyProvider
  implements vscode.TreeDataProvider<Dependency>{

  private _onDidChangeTreeData: vscode.EventEmitter<
  Dependency | undefined | null | void
  > = new vscode.EventEmitter<Dependency | undefined | null | void>();

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Dependency) {
    if (element) {
      return element.getChildren();
    }
    return Promise.resolve(
      state.dependencies.map((dep: any) => {
        return new Dependency(dep);
      })
    );
  }
}

class Dependency extends vscode.TreeItem {
  reference: string;

  constructor(
    public readonly dep: any
  ) {
    super(dep.name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = dep.description;
    this.reference = dep.reference;
    this.description = `${dep.latestVersion === '1.0' ? '' : dep.latestVersion}${dep.category === 'first-party' ? ' (Fliplet)' : ''} ${dep.preloaded ? 'Always included' : ''}`;
  }

  iconPath = new vscode.ThemeIcon("repo-delete");
  contextValue = "file";

  command = {
    "title": "Show documentation",
    "command": "dependency.view",
    arguments: [this]
  };

  async getChildren() {
    return Promise.resolve([]);
  }
}

export class DependencyExplorer {
  treeDataProvider: DependencyProvider;

  constructor(context: vscode.ExtensionContext) {
    const treeDataProvider = new DependencyProvider();
    context.subscriptions.push(
      vscode.window.createTreeView("dependencies", { treeDataProvider })
    );

    vscode.commands.registerCommand("dependency.view", async (item: Dependency) => {
      const panel = vscode.window.createWebviewPanel(
        item.dep.name,
        item.dep.name,
        vscode.ViewColumn.One,
        {
          enableScripts: true
        }
      );

      panel.webview.html = getWebviewContent(item.dep.name, item.dep.reference);
    });

    this.treeDataProvider = treeDataProvider;
  }

  refresh() {
    this.treeDataProvider.refresh();
  }
}

function getWebviewContent(name: string, reference: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation for ${name}</title>
    <style>* {border:0;margin:0;padding:0;}</style>
</head>
<body>
  <iframe style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;" src="${reference}" width="100%" height="100%"></iframe>
</body>
</html>`;
}
