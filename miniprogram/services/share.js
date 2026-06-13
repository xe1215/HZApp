const { callBusinessFunction } = require("./cloud");

function createShareEntry(data) {
  return callBusinessFunction("share", "createShareEntry", data);
}

function trackShareVisit(data) {
  return callBusinessFunction("share", "trackShareVisit", data);
}

module.exports = {
  createShareEntry,
  trackShareVisit,
};
