const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

function ok(data) {
  return {
    code: 0,
    message: "ok",
    data: data || null,
  };
}

function unsupported(action) {
  return {
    code: "INVALID_ACTION",
    message: `Unsupported action: ${action || "unknown"}`,
    data: null,
  };
}

exports.main = async (event) => {
  const action = event && event.action;

  if (action === "createReportOrder") {
    return ok({ amount: 599, currency: "CNY", paymentStatus: "pending" });
  }

  if (action === "confirmPayment") {
    return ok({ paymentStatus: "confirmed" });
  }

  return unsupported(action);
};
