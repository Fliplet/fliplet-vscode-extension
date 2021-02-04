const vscode = require('vscode');

const Tree = function(options) {
  console.log(options)

  const apps = options.state.apps;

  return {
    getTreeItem(element) {
      return element;
    },
    getChildren(element) {
      return Promise.resolve(apps.map(function (app) {
        return {
          label: app.title
        }
      }));

      return Promise.resolve([
        { label: 'Foo' }
      ]);
    }
  };
};

const Item = {
  label: 'Foo'
};

module.exports.Tree = Tree;