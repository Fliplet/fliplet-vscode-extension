/* eslint-disable @typescript-eslint/naming-convention */
const state = require('./state');

const axios = require("axios").default;

let currentToken;

let baseURL = "https://api.fliplet.com/";

module.exports.create = function CreateAPI(authToken) {
  currentToken = authToken;

  state.api = axios.create({
    baseURL,
    headers: { "Auth-token": authToken, "X-Third-Party": 'com.fliplet.vscode' },
  });
};

module.exports.previewUrl = function (appId, pageId) {
  return `${baseURL}v1/apps/${appId}/pages/${pageId}/view?interact=false&auth_token=${currentToken}&disableSecurity&autoreload`;
};