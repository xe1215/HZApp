const { callBusinessFunction } = require("./cloud");

function getPreview(data) {
  return callBusinessFunction("report", "getPreview", data);
}

function getReport(data) {
  return callBusinessFunction("report", "getReport", data);
}

function listMyReports() {
  return callBusinessFunction("report", "listMyReports");
}

module.exports = {
  getPreview,
  getReport,
  listMyReports,
};
