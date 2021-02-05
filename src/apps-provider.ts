import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import * as moment from "moment";

const _ = require("lodash");
const temp = require("fs-temp");

const state = require("./state");

namespace util {
  function handleResult<T>(
    resolve: (result: T) => void,
    reject: (error: Error) => void,
    error: Error | null | undefined,
    result: T
  ): void {
    if (error) {
      reject(error);
    } else {
      resolve(result);
    }
  }

  export function stat(path: string): Promise<fs.Stats> {
    return new Promise<fs.Stats>((resolve, reject) => {
      fs.stat(path, (error, stat) =>
        handleResult(resolve, reject, error, stat)
      );
    });
  }
}

export class FileStat implements vscode.FileStat {
  constructor(private fsStat: fs.Stats) {}

  get type(): vscode.FileType {
    return this.fsStat.isFile()
      ? vscode.FileType.File
      : this.fsStat.isDirectory()
      ? vscode.FileType.Directory
      : this.fsStat.isSymbolicLink()
      ? vscode.FileType.SymbolicLink
      : vscode.FileType.Unknown;
  }

  get isFile(): boolean | undefined {
    return this.fsStat.isFile();
  }

  get isDirectory(): boolean | undefined {
    return this.fsStat.isDirectory();
  }

  get isSymbolicLink(): boolean | undefined {
    return this.fsStat.isSymbolicLink();
  }

  get size(): number {
    return this.fsStat.size;
  }

  get ctime(): number {
    return this.fsStat.ctime.getTime();
  }

  get mtime(): number {
    return this.fsStat.mtime.getTime();
  }
}

interface Entry {
  uri: vscode.Uri;
  type: vscode.FileType;
}

export class AppsProvider
  implements vscode.TreeDataProvider<App>, vscode.FileSystemProvider {
  constructor(private state: any) {
    this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  }
  readDirectory(
    uri: vscode.Uri
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    throw new Error("Method not implemented.");
  }
  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }
  readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
    throw new Error("Method not implemented.");
  }
  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }
  delete(
    uri: vscode.Uri,
    options: { recursive: boolean }
  ): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }
  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean }
  ): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }

  private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
  private _onDidChangeTreeData: vscode.EventEmitter<
    App | undefined | null | void
  > = new vscode.EventEmitter<App | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    App | undefined | null | void
  > = this._onDidChangeTreeData.event;

  get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  watch(
    uri: vscode.Uri,
    options: { recursive: boolean; excludes: string[] }
  ): vscode.Disposable {
    const watcher = fs.watch(
      uri.fsPath,
      { recursive: options.recursive },
      async (event: string, filename: string | Buffer) => {
        const filepath = path.join(uri.fsPath, filename.toString());

        this._onDidChangeFile.fire([
          {
            type: vscode.FileChangeType.Changed,
            uri: uri.with({ path: filepath }),
          } as vscode.FileChangeEvent,
        ]);
      }
    );

    return { dispose: () => watcher.close() };
  }

  stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
    return this._stat(uri.fsPath);
  }

  async _stat(path: string): Promise<vscode.FileStat> {
    return new FileStat(await util.stat(path));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: App): vscode.TreeItem {
    return element;
  }

  getChildren(element?: App) {
    if (element) {
      return element.getChildren();
    }
    return Promise.resolve(
      this.state.apps.map((app: any) => {
        return new App(app, 1);
      })
    );
  }
}

class Page extends vscode.TreeItem {
  app: any;
  pageData: any;

  constructor(
    public readonly page: any,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    app: any
  ) {
    super(page.title, collapsibleState);
    this.tooltip = `${moment(page.updatedAt).fromNow()}`;
    this.description = this.tooltip;
    this.app = app;
    this.pageData = page;
  }

  contextValue = "folder";
  iconPath = vscode.ThemeIcon.Folder;

  getChildren() {
    return Promise.resolve([
      new File({
        label: "Screen Layout",
        type: "html",
        content: this.pageData.layout,
        page: this.pageData,
        app: this.app,
        ext: "html",
      }),
      new File({
        label: "Screen JavaScript",
        type: "javascript",
        content: _.get(this.pageData, "settings.customJS"),
        page: this.pageData,
        app: this.app,
        ext: "js",
      }),
      new File({
        label: "Screen CSS",
        type: "scss",
        content: _.get(this.pageData, "settings.customSCSS"),
        page: this.pageData,
        app: this.app,
        ext: "scss",
      }),
    ]);
  }
}

class App extends vscode.TreeItem {
  pages?: Array<Page | File>;
  appData: any;

  constructor(
    public readonly app: any,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(app.name, collapsibleState);
    this.tooltip = `Last updated ${moment(app.updatedAt).fromNow()}`;
    this.description = moment(app.updatedAt).fromNow();
    this.appData = app;
  }

  iconPath = vscode.ThemeIcon.Folder;
  contextValue = "folder";

  async getChildren() {
    if (!Array.isArray(this.pages)) {
      const pages = (await state.api.get(`v1/apps/${this.app.id}/pages`)).data
        .pages;

      this.pages = pages.map((page: any) => {
        return new Page(page, 1, this.appData);
      });

      if (this.pages) {
        this.pages.unshift(
          new File({
            label: "Global CSS",
            type: "css",
            content: _.get(this.app, "settings.customSCSS"),
            app: this.appData,
            ext: "css",
          })
        );

        this.pages.unshift(
          new File({
            label: "Global JavaScript",
            type: "javascript",
            content: _.get(this.app, "settings.customJS"),
            app: this.appData,
            ext: "js",
          })
        );
      }
    }

    return Promise.resolve(this.pages);
  }
}

class File extends vscode.TreeItem {
  page: any;
  app: any;
  type: vscode.FileType;
  content: string;
  uri?: string;
  ext: string;

  constructor(public readonly data: any) {
    super(data.label, vscode.TreeItemCollapsibleState.None);
    this.type = data.type;
    this.content = data.content;
    this.app = data.app;
    this.page = data.page;
    this.ext = data.ext;
    this.tooltip = "Click to edit";
  }

  command = {
    title: "Edit file",
    command: "apps.openFile",
    arguments: [this],
  };

  contextValue = "file";
  iconPath = vscode.ThemeIcon.File;

  async getChildren() {
    return Promise.resolve([]);
  }
}

const myProvider = new (class implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    // invoke cowsay, use uri-path as text
    return "foo";
  }
})();

export class FileExplorer {
  treeDataProvider: AppsProvider;

  constructor(context: vscode.ExtensionContext) {
    const treeDataProvider = new AppsProvider(state);
    context.subscriptions.push(
      vscode.window.createTreeView("apps", { treeDataProvider })
    );
    vscode.commands.registerCommand("apps.openFile", async (file: File) => {
      if (!file.uri) {
        try {
          let basePath = path.join(
            os.tmpdir(),
            "fliplet",
            file.app.name
          );

          if (!fs.existsSync(basePath)) {
            fs.mkdirSync(basePath);
          }

          if (file.page) {
            basePath = path.join(
              os.tmpdir(),
              "fliplet",
              file.app.name,
              file.page.title
            );

            if (!fs.existsSync(basePath)) {
              fs.mkdirSync(basePath);
            }
          }

          let fileName;

          if (file.page) {
            fileName = file.page.title;
          } else {
            fileName = file.app.name;
          }

          fileName += `.${file.ext}`;

          file.uri = path.join(basePath, fileName);

          fs.writeFileSync(file.uri, file.content || "");
        } catch (err) {
          console.error(err);
          vscode.window.showErrorMessage(err);
        }
      }

      if (!file.uri) {
        return;
      }

      let doc = await vscode.workspace.openTextDocument(file.uri); // calls back into the provider
      const d = await vscode.window.showTextDocument(doc, { preview: false });

      vscode.languages.setTextDocumentLanguage(
        d.document,
        file.type.toString()
      );

      return;

      /*
      vscode.window.showTextDocument(file.uri, { preview: false }).then((doc) => {
        vscode.languages.setTextDocumentLanguage(doc.document, "JavaScript");
      });*/
    });

    vscode.workspace.registerTextDocumentContentProvider("fliplet", myProvider);

    this.treeDataProvider = treeDataProvider;
  }

  private openResource(resource: vscode.Uri): void {
    vscode.window.showTextDocument(resource);
  }

  refresh() {
    this.treeDataProvider.refresh();
  }
}

// vscode.window.registerTreeDataProvider("apps", tree);

vscode.commands.registerCommand("file.edit", function () {});
