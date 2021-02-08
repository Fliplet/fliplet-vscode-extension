import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import * as moment from "moment";

const _ = require("lodash");
const md5: Function = require("md5");

const api = require("./api");
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
    this.id = `page-${page.id}`;
    this.pageData = page;
  }

  contextValue = "screen";
  iconPath = new vscode.ThemeIcon("notebook-render-output");

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
      new Components(this.page, 1),
    ]);
  }
}

class Component extends vscode.TreeItem {
  constructor(public readonly component: any, public readonly page: any) {
    super(component.widget ? component.widget.name : component.package, 0);
  }

  iconPath = new vscode.ThemeIcon("notebook-mimetype");

  command = {
    title: "Configure component",
    command: "page.configureComponent",
    arguments: [this],
  };
}

class Components extends vscode.TreeItem {
  components?: Array<Component>;

  constructor(
    public readonly page: any,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super("Components", collapsibleState);
    this.page = page;
  }

  iconPath = new vscode.ThemeIcon("extensions-view-icon");

  async getChildren() {
    if (!Array.isArray(this.components)) {
      this.components = (
        await state.api.get(`v1/widget-instances?pageId=${this.page.id}`)
      ).data.widgetInstances;

      const widgetInstancesInUse = _.get(
        this.page,
        "settings.widgetInstancesInUse"
      );

      if (this.components) {
        const widgets = await api.getWidgets();

        this.components = _.compact(
          this.components.map((instance: any) => {
            const widget = _.find(widgets, { id: instance.widgetId });

            if (!widget) {
              return;
            }

            if (
              Array.isArray(widgetInstancesInUse) &&
              widgetInstancesInUse.indexOf(instance.id) === -1
            ) {
            }

            instance.widget = widget;

            return new Component(instance, this.page);
          })
        );
      }
    }

    return Promise.resolve(this.components);
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
    this.id = `app-${app.id}`;
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
            type: "scss",
            content: _.get(this.app, "settings.customSCSS"),
            app: this.appData,
            ext: "scss",
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
    this.tooltip = "";
  }

  command = {
    title: "Edit file",
    command: "apps.openFile",
    arguments: [this],
  };

  iconPath = new vscode.ThemeIcon("notebook-open-as-text");

  async getChildren() {
    return Promise.resolve([]);
  }
}

function fileHash(path: string) {
  const name = _.last(path.toLowerCase().split(state.organization.name));
  return md5(name);
}

export class FileExplorer {
  treeDataProvider: AppsProvider;

  constructor(context: vscode.ExtensionContext) {
    const treeDataProvider = new AppsProvider(state);
    context.subscriptions.push(
      vscode.window.createTreeView("apps", { treeDataProvider })
    );

    vscode.workspace.onWillSaveTextDocument(async (event) => {
      const hash = fileHash(event.document.fileName);
      const data: any = context.workspaceState.get(hash);

      if (!state.user.id) {
        return; // not logged in
      }

      if (!data) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          cancellable: false,
          title: "Saving to Fliplet",
        },
        async (progress) => {
          progress.report({ increment: 100 });

          function updateDoc(text: string) {
            const edit = new vscode.WorkspaceEdit();
            const firstLine = event.document.lineAt(0);
            const lastLine = event.document.lineAt(
              event.document.lineCount - 1
            );
            const textRange = new vscode.Range(
              firstLine.range.start,
              lastLine.range.end
            );

            edit.replace(event.document.uri, textRange, text);
            vscode.workspace.applyEdit(edit);
          }

          const app = _.find(state.apps, { id: data.appId });
          const content = event.document.getText();

          try {
            if (data.pageId) {
              if (data.ext === "js" || data.ext === "scss") {
                if (data.ext === "js") {
                  await state.api.post(
                    `v1/apps/${data.appId}/pages/${data.pageId}/settings`,
                    {
                      customJS: content,
                    }
                  );
                } else {
                  await state.api.post(
                    `v1/apps/${data.appId}/pages/${data.pageId}/settings`,
                    {
                      customSCSS: content,
                    }
                  );
                }
              } else if (data.ext === "html") {
                await state.api
                  .put(
                    `v1/apps/${data.appId}/pages/${data.pageId}/rich-layout`,
                    {
                      richLayout: content,
                    }
                  )
                  .then((response: any) => {
                    updateDoc(response.data.page.richLayout);
                  });
              }
            } else {
              if (data.ext === "js") {
                await state.api.post(`v1/apps/${data.appId}/settings`, {
                  customJS: content,
                });

                app.settings.customJS = content;
              } else if (data.ext === "scss") {
                await state.api.post(`v1/apps/${data.appId}/settings`, {
                  customSCSS: content,
                });

                app.settings.customSCSS = content;
              }
            }
            treeDataProvider.refresh();

            progress.report({ increment: 100 });
          } catch (e) {
            console.error(e);
            vscode.window.showErrorMessage(e);
          }
        }
      );
    });

    vscode.workspace.onDidCloseTextDocument((doc) => {
      context.workspaceState.update(fileHash(doc.fileName), undefined);
    });

    vscode.commands.registerCommand("page.preview", async (page: Page) => {
      const url = api.previewUrl(page.app.id, page.page.id);

      const title = `${page.pageData.title} (${page.app.name})`;

      const panel = vscode.window.createWebviewPanel(
        page.pageData.id.toString(),
        title,
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
        }
      );

      panel.webview.html = getWebviewContent(title, url);
    });

    vscode.commands.registerCommand("page.configureComponent", function (instance: Component) {
      const url = api.interfaceUrl(instance.component.id);

      debugger;

      const title = instance.component.widget.id;

      const panel = vscode.window.createWebviewPanel(
        instance.component.id.toString(),
        title,
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
        }
      );

      panel.webview.html = getInteraceWebViewContent(title, url);
    });

    vscode.commands.registerCommand("apps.openFile", async (file: File) => {
      if (!file.uri) {
        try {
          let basePath = path.join(
            os.tmpdir(),
            "Fliplet",
            state.organization.name,
            `${file.app.name.substr(0, 32)}-${file.app.id}`
          );

          if (!fs.existsSync(basePath)) {
            try {
              fs.mkdirSync(basePath, { recursive: true });
            } catch (e) {
              console.error(e);
            }
          }

          if (file.page) {
            basePath = path.join(
              os.tmpdir(),
              "Fliplet",
              state.organization.name,
              `${file.app.name.substr(0, 32)}-${file.app.id}`,
              `${file.page.id}`
            );

            if (!fs.existsSync(basePath)) {
              try {
                fs.mkdirSync(basePath, { recursive: true });
              } catch (e) {
                console.error(e);
              }
            }
          }

          let fileName;

          if (file.page) {
            fileName = `${file.page.title.substr(0, 32)}`;
          } else {
            fileName = `${file.app.name.substr(0, 32)}`;
          }

          fileName += `.${file.ext}`;

          file.uri = path.join(basePath, fileName);

          context.workspaceState.update(fileHash(file.uri), {
            ext: file.ext,
            appId: file.app.id,
            pageId: file.page ? file.page.id : undefined,
          });

          // Fetch rich content
          if (file.ext === "html") {
            const interactVersion = parseInt(
              _.get(file.app, "settings.interactVersion") || 2,
              10
            );

            if (interactVersion > 2) {
              const page = (
                await state.api.get(
                  `v1/apps/${file.app.id}/pages/${file.page.id}?richLayout`
                )
              ).data.page;

              if (page && page.richLayout) {
                file.content = page.richLayout;
              }
            }
          }

          fs.writeFileSync(file.uri, file.content || "");
        } catch (err) {
          console.error(err);
          vscode.window.showErrorMessage(err);
        }
      }

      if (!file.uri) {
        return;
      }

      const doc = await vscode.workspace.openTextDocument(file.uri);
      const editor = await vscode.window.showTextDocument(doc, {
        preview: true,
      });

      vscode.languages.setTextDocumentLanguage(
        editor.document,
        file.type.toString()
      );
    });

    this.treeDataProvider = treeDataProvider;
  }

  refresh() {
    this.treeDataProvider.refresh();
  }
}

function getWebviewContent(name: string, url: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <style>* {border:0;margin:0;padding:0;}</style>
</head>
<body>
  <iframe style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;" src="${url}" width="100%" height="100%"></iframe>
</body>
</html>`;
}


function getInteraceWebViewContent(name: string, url: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <style>* {border:0;margin:0;padding:0;}</style>
</head>
<body>
  <iframe style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;" src="${url}" width="100%" height="100%"></iframe>
</body>
</html>`;
}
