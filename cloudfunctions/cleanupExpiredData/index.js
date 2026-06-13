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

exports.main = async () => {
  return ok({
    cleaned: false,
    reason: "cleanup policy skeleton only",
  });
};
