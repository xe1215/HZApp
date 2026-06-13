const { callBusinessFunction } = require("./cloud");

function createTest(data) {
  return callBusinessFunction("test", "createTest", data);
}

function uploadSelfie(data) {
  return callBusinessFunction("test", "uploadSelfie", data);
}

function submitPreferences(data) {
  return callBusinessFunction("test", "submitPreferences", data);
}

function regeneratePreview(data) {
  return callBusinessFunction("test", "regeneratePreview", data);
}

module.exports = {
  createTest,
  uploadSelfie,
  submitPreferences,
  regeneratePreview,
};
