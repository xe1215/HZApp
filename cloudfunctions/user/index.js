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

function fail(code, message, data) {
  return {
    code: code || -1,
    message: message || "error",
    data: data || null,
  };
}

function unsupported(action) {
  return fail("INVALID_ACTION", `Unsupported action: ${action || "unknown"}`);
}

function getRuntime(deps) {
  return {
    db: deps && deps.db ? deps.db : cloud.database(),
    wxContext: deps && deps.wxContext ? deps.wxContext : cloud.getWXContext(),
    now: deps && deps.now ? deps.now : () => new Date(),
  };
}

async function silentLogin(deps) {
  const runtime = getRuntime(deps);
  const wxContext = runtime.wxContext || {};
  const openid = wxContext.OPENID;

  if (!openid) {
    return fail("LOGIN_REQUIRED", "OPENID is missing from WeChat context");
  }

  const now = runtime.now().toISOString();
  const users = runtime.db.collection("users");
  const existing = await users.where({ openid }).get();
  const existingUser = existing.data && existing.data[0];

  if (existingUser) {
    await users.where({ openid }).update({
      data: {
        lastSeenAt: now,
        appid: wxContext.APPID || "",
        unionid: wxContext.UNIONID || "",
      },
    });
  } else {
    await users.add({
      data: {
        openid,
        appid: wxContext.APPID || "",
        unionid: wxContext.UNIONID || "",
        createdAt: now,
        lastSeenAt: now,
      },
    });
  }

  return ok({
    openid,
    appid: wxContext.APPID || "",
    unionid: wxContext.UNIONID || "",
    isNewUser: !existingUser,
  });
}

async function main(event, context, deps) {
  const action = event && event.action ? event.action : "silentLogin";

  try {
    if (action === "silentLogin") {
      return await silentLogin(deps);
    }

    return unsupported(action);
  } catch (error) {
    return fail("USER_FUNCTION_ERROR", error.message);
  }
}

exports.main = main;
exports.silentLogin = silentLogin;
