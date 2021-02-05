import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import * as moment from 'moment';

export class AppsProvider implements vscode.TreeDataProvider<App> {
  constructor(private state: any, private api: object) {}

  private _onDidChangeTreeData: vscode.EventEmitter<App | undefined | null | void> = new vscode.EventEmitter<App | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<App | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: App): vscode.TreeItem {
    return element;
  }

  getChildren(element?: App): Thenable<App[]> {
    return Promise.resolve(this.state.apps.map((app: any) => {
      return new App(app, 1);
    }));
  }
}

class App extends vscode.TreeItem {
  constructor(
    public readonly app: any,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(app.label, collapsibleState);
    this.tooltip = `Last updated ${moment(app.updatedAt).fromNow()}`;
    this.description = app.name;
  }

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  };
}