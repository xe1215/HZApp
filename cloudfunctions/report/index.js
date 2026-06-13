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

  if (action === "getPreview") {
    return ok({ status: "active", locked: true });
  }

  if (action === "getReport") {
    return ok({ status: "locked" });
  }

  if (action === "listMyReports") {
    return ok({ reports: [] });
  }

  return unsupported(action);
};
