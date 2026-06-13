const { callBusinessFunction } = require("./cloud");

function createReportOrder(data) {
  return callBusinessFunction("payment", "createReportOrder", data);
}

function confirmPayment(data) {
  return callBusinessFunction("payment", "confirmPayment", data);
}

module.exports = {
  createReportOrder,
  confirmPayment,
};
