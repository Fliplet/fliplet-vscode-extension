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
    this.tooltip = `ID ${page.id}`;
    this.description = moment(page.updatedAt).fromNow();
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
        contextValue: "screen",
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
      new Components(this.page, this.app, 1),
    ]);
  }
}

class Component extends vscode.TreeItem {
  content?: string;
  uri?: string;
  ext = "json";
  type: vscode.FileType;

  constructor(
    public readonly component: any,
    public readonly page: any,
    public readonly app: any
  ) {
    super(component.widget ? component.widget.name : component.package, 0);

    this.type = vscode.FileType.File;

    const label =
      _.get(component.settings, "label") ||
      _.get(component.settings, "title") ||
      _.get(component.settings, "name");

    if (label && typeof label === "string") {
      this.description = label;
    }

    this.tooltip = `ID ${component.id} - ${moment(
      component.updatedAt
    ).fromNow()}`;
  }

  iconPath = new vscode.ThemeIcon("symbol-misc");
  contextValue = "component";

  command = {
    title: "Edit component settings",
    command: "apps.openFile",
    arguments: [this],
  };
}

class Components extends vscode.TreeItem {
  components?: Array<Component>;

  constructor(
    public readonly page: any | undefined,
    public readonly app: any,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    label?: string
  ) {
    super(label || "Components", collapsibleState);
  }

  iconPath = new vscode.ThemeIcon("extensions-view-icon");

  async getChildren() {
    if (!Array.isArray(this.components)) {
      let widgetInstancesInUse: undefined | Array<number>;

      if (this.page) {
        this.components = (
          await state.api.get(`v1/widget-instances?pageId=${this.page.id}`)
        ).data.widgetInstances;

        widgetInstancesInUse = _.get(
          this.page,
          "settings.widgetInstancesInUse"
        );
      } else {
        this.components = (
          await state.api.get(`v1/widget-instances?appId=${this.app.id}`)
        ).data.widgetInstances;
      }

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
              return; // skip instances that aren't on the page
            }

            instance.widget = widget;

            return new Component(instance, this.page, this.app);
          })
        );
      }
    }

    return Promise.resolve(this.components);
  }
}

class DataSourceEntries extends vscode.TreeItem {
  content?: string;
  uri?: string;
  page?: any;
  ext = "json";
  type: vscode.FileType;
  entries?: Array<any>;

  constructor(public readonly dataSource: any, public readonly app: any) {
    super("Entries", 0);
    this.type = vscode.FileType.File;
  }

  iconPath = new vscode.ThemeIcon("symbol-keyword");
  contextValue = "dataSourceEntries";

  command = {
    title: "Edit entries",
    command: "apps.openFile",
    arguments: [this],
  };
}

class DataSourceMetadata extends vscode.TreeItem {
  content?: string;
  uri?: string;
  ext = "json";
  page?: any;
  type: vscode.FileType;

  constructor(public readonly dataSource: any, public readonly app: any) {
    super("Settings", 0);
    this.type = vscode.FileType.File;
  }

  iconPath = new vscode.ThemeIcon("symbol-constant");
  contextValue = "dataSourceMetadata";

  command = {
    title: "Edit settings",
    command: "apps.openFile",
    arguments: [this],
  };
}

class DataSource extends vscode.TreeItem {
  content?: string;
  uri?: string;
  ext = "json";
  type: vscode.FileType;
  children?: Array<DataSourceEntries | DataSourceMetadata>;

  constructor(
    public readonly dataSource: any,
    public readonly app: any,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(dataSource.name, collapsibleState);

    this.type = vscode.FileType.Directory;
    this.description = moment(dataSource.updatedAt).fromNow();
    this.tooltip = `ID ${dataSource.id} - ${
      dataSource.columns ? dataSource.columns.length : 0
    } columns`;
  }

  iconPath = new vscode.ThemeIcon("symbol-function");
  contextValue = "dataSource";

  async getChildren() {
    if (!this.children) {
      this.children = [
        new DataSourceMetadata(this.dataSource, this.app),
        new DataSourceEntries(this.dataSource, this.app),
      ];
    }

    return Promise.resolve(this.children);
  }
}

class DataSources extends vscode.TreeItem {
  dataSources?: Array<DataSource>;

  constructor(
    public readonly app: any,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super("Data Sources", collapsibleState);
  }

  iconPath = new vscode.ThemeIcon("database");
  contextValue = "dataSources";

  async getChildren() {
    if (!Array.isArray(this.dataSources)) {
      this.dataSources = (
        await state.api.get(
          `v1/data-sources?roles=publisher,editor&appId=${this.app.id}`
        )
      ).data.dataSources;

      const inUse = _.get(this.app, "dataSourcesInUse").concat(
        _.get(this.app, "settings.customDataSourcesInUse", [])
      );

      if (this.dataSources) {
        this.dataSources = _.compact(
          this.dataSources.map((instance: any) => {
            if (["conversation"].indexOf(instance.type) !== -1) {
              return;
            }

            if (inUse && inUse.indexOf(instance.id) === -1) {
              return;
            }

            return new DataSource(instance, this.app, 1);
          })
        );
      }
    }

    return Promise.resolve(this.dataSources);
  }
}

class App extends vscode.TreeItem {
  pages?: Array<Page | File | Components | DataSources>;
  appData: any;

  constructor(
    public readonly app: any,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(app.name, collapsibleState);
    this.tooltip = `ID ${app.id}`;
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

        this.pages.unshift(new DataSources(this.app, 1));
        this.pages.unshift(
          new Components(undefined, this.app, 1, "Add-ons & Components")
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
    this.contextValue = data.contextValue;
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
            if (data.dataSourceId) {
              if (data.contextValue === "dataSourceEntries") {
                const entries = (await state.api.post(
                  `v1/data-sources/${data.dataSourceId}/commit`,
                  {
                    entries: JSON.parse(content),
                    source: "vscode",
                  }
                )).data.entries;

                updateDoc(JSON.stringify(
                  entries.map((entry: any) => {
                    return _.pick(entry, [
                      "id",
                      "data",
                      "createdAt",
                      "updatedAt",
                    ]);
                  }),
                  null,
                  2
                ));
              } else if (data.contextValue === "dataSourceMetadata") {
                await state.api.put(
                  `v1/data-sources/${data.dataSourceId}`,
                  JSON.parse(content)
                );
              }
            } else if (data.widgetInstanceId) {
              await state.api.put(
                `v1/widget-instances/${data.widgetInstanceId}`,
                JSON.parse(content)
              );
            } else if (data.pageId) {
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
          } catch (err) {
            console.error(err);
            vscode.window.showErrorMessage(_.get(err, 'response.data.message') || err.message);
          }
        }
      );
    });

    vscode.workspace.onDidCloseTextDocument((doc) => {
      context.workspaceState.update(fileHash(doc.fileName), undefined);
    });

    vscode.commands.registerCommand(
      "component.configure",
      async (item: Component) => {}
    );

    vscode.commands.registerCommand(
      "page.preview",
      async (item: Page | File) => {
        const url = api.previewUrl(item.app.id, item.page.id);
        const pageData = item.page;
        const title = `${pageData.title} (${item.app.name})`;

        const panel = vscode.window.createWebviewPanel(
          pageData.id.toString(),
          title,
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
          }
        );

        vscode.commands.executeCommand("setContext", "hasPreviews", true);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
          (data) => {
            switch (data.event) {
              case "user-script-error":
                vscode.window.showErrorMessage(data.error);
                return;
            }
          },
          undefined,
          context.subscriptions
        );

        panel.webview.html = getWebviewContent(title, url);
      }
    );

    vscode.commands.registerCommand(
      "page.configureComponent",
      function (instance: Component) {
        const url = api.interfaceUrl(instance.component.id);
        const title = instance.component.widget.name;

        const panel = vscode.window.createWebviewPanel(
          instance.component.id.toString(),
          title,
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
          }
        );

        panel.webview.html = getInteraceWebViewContent(title, url);
      }
    );

    vscode.commands.registerCommand(
      "page.deleteComponent",
      async function (instance: Component) {
        vscode.window
          .showInformationMessage(
            `Do you want to delete this ${instance.label} component?`,
            "Delete",
            "Dismiss"
          )
          .then(async (label) => {
            if (label === "Delete") {
              await state.api.delete(
                `v1/widget-instances/${instance.component.id}`
              );
              treeDataProvider.refresh();

              vscode.window.showInformationMessage(
                `The component has been deleted.`
              );
            }
          });
      }
    );

    vscode.commands.registerCommand(
      "dataSource.create",
      async function (instance: DataSources) {
        vscode.window
          .showInputBox({
            prompt: "Enter the name of your new Data Source",
            placeHolder: "Data Source name",
          })
          .then(async (name) => {
            if (!name) {
              vscode.window.showErrorMessage("A name is required");

              return;
            }

            try {
              const dataSource = (
                await state.api.post(`v1/data-sources`, {
                  name,
                  appId: instance.app.id,
                  accessRules: [
                    {
                      type: ["select", "insert", "update", "delete"],
                      allow: "all",
                      appId: [instance.app.id],
                      enabled: true,
                    },
                  ],
                })
              ).data.dataSource;

              const customDataSourcesInUse = _.get(
                instance.app,
                "settings.customDataSourcesInUse",
                []
              );
              customDataSourcesInUse.push(dataSource.id);

              await state.api.post(`v1/apps/${instance.app.id}/settings`, {
                customDataSourcesInUse,
              });

              instance.app.dataSourcesInUse = instance.app.dataSourcesInUse.concat(
                customDataSourcesInUse
              );

              treeDataProvider.refresh();
            } catch (err) {
              vscode.window.showErrorMessage(err.message);
            }
          });
      }
    );

    vscode.commands.registerCommand(
      "apps.openFile",
      async (
        file: File | Component | DataSourceEntries | DataSourceMetadata
      ) => {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Window,
            cancellable: false,
            title: "Retrieving data",
          },
          async (progress) => {
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

                if (file instanceof DataSourceMetadata) {
                  fileName = `${file.dataSource.name.substr(0, 32)}-${
                    file.dataSource.id
                  }-settings`;
                } else if (file instanceof DataSourceEntries) {
                  fileName = `${file.dataSource.name.substr(0, 32)}-${
                    file.dataSource.id
                  }-entries`;
                } else if (file instanceof Component) {
                  fileName = `${file.component.widget.name.substr(0, 32)}-${
                    file.component.id
                  }`;
                } else if (file.page) {
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
                  widgetInstanceId:
                    file instanceof Component ? file.component.id : undefined,
                  dataSourceId:
                    file instanceof DataSourceMetadata ||
                    file instanceof DataSourceEntries
                      ? file.dataSource.id
                      : undefined,
                  contextValue: file.contextValue,
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

                if (file instanceof DataSourceMetadata) {
                  file.content = JSON.stringify(
                    _.pick(file.dataSource, [
                      "name",
                      "hooks",
                      "columns",
                      "definition",
                      "bundle",
                      "accessRules",
                    ]),
                    null,
                    2
                  );
                } else if (file instanceof DataSourceEntries) {
                  progress.report({
                    message: "fetching entries",
                    increment: 50,
                  });

                  let entries;

                  try {
                    entries = (
                      await state.api.get(
                        `v1/data-sources/${file.dataSource.id}/data/query?appId=${file.app.id}`
                      )
                    ).data.entries;

                    file.entries = entries.map((entry: any) => {
                      return _.pick(entry, [
                        "id",
                        "data",
                        "createdAt",
                        "updatedAt",
                      ]);
                    });
                  } catch (err) {
                    vscode.window.showErrorMessage(_.get(err, 'response.data.message') || err.message);
                  }

                  file.description = `${file.entries} entries`;

                  file.content = JSON.stringify(file.entries || [], null, 2);
                }

                if (file instanceof Component) {
                  file.content = JSON.stringify(
                    _.get(file.component, "settings"),
                    null,
                    2
                  );
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

            progress.report({ increment: 100 });

            const doc = await vscode.workspace.openTextDocument(file.uri);
            const editor = await vscode.window.showTextDocument(doc, {
              preview: true,
            });

            vscode.languages.setTextDocumentLanguage(
              editor.document,
              file.type.toString()
            );
          }
        );
      }
    );

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
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" crossorigin="anonymous"></script>
    <script>
const vscode = acquireVsCodeApi();

window.addEventListener('message', function (event) {
  if (event.data) {
    if (event.data.event === 'set-page') {
      var $iframe = $('iframe');
      var src = $iframe.attr('src').replace(/pages\\/([0-9]+)/, 'pages/' + event.data.pageId);

      $iframe.attr('src', src);
    } else if (event.data.event === 'user-script-error') {
      vscode.postMessage(event.data);
    }
  }
})
    </script>
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
    <style>
* {border:0;margin:0;padding:0;}
body {
  overflow-x: hidden;
}
iframe {
  background-color: #f8f6f7;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 30px;
}
footer {
  padding: 1rem 15px;
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 30px;
  display: flex;
  align-items: center;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}
    </style>
</head>
<body>
  <iframe src="${url}" width="100%" height="100%"></iframe>
  <footer>
    <a data-save href="#">Save &amp; Close</a>
  </footer>
</body>
</html>`;
}
