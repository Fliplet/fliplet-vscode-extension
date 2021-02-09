/* eslint-disable @typescript-eslint/naming-convention */
const state = require('./state');
const axios = require("axios").default;
const vscode = require('vscode');

const version = vscode.extensions.getExtension('fliplet.vscode').packageJSON.version;

const primaryBaseURL = "https://api.fliplet.com/";
let currentToken;

let baseURL = primaryBaseURL;
let widgets;

module.exports.baseURL = function () {
  return baseURL;
};

module.exports.restoreBaseUrl = function () {
  baseURL = primaryBaseURL;
};

module.exports.getWidgets = async function () {
  if (!widgets) {
    widgets = (await state.api.get('v1/widgets')).data.widgets;
  }

  return widgets;
};

module.exports.create = function CreateAPI(authToken, url) {
  currentToken = authToken;

  if (url) {
    baseURL = url;

    console.log('Base url updated', url);
  }

  state.api = axios.create({
    baseURL,
    headers: { "Auth-token": authToken || '', 'User-Agent': `VSCode/${version}` },
  });
};

module.exports.previewUrl = function (appId, pageId) {
  return `${baseURL}v1/apps/${appId}/pages/${pageId}/view?interact=false&auth_token=${currentToken}&disableSecurity&autoreload`;
};

module.exports.interfaceUrl = function (widgetInstanceId) {
  return `${baseURL}v1/widget-instances/${widgetInstanceId}/interface?auth_token=${currentToken}`;
};