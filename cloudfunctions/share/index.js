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

  if (action === "createShareEntry") {
    return ok({ sharePath: "/pages/share/index" });
  }

  if (action === "trackShareVisit") {
    return ok({ tracked: true });
  }

  return unsupported(action);
};
