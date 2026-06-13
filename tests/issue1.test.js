const assert = require("assert");
const Module = require("module");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "wx-server-sdk") {
    return {
      DYNAMIC_CURRENT_ENV: "DYNAMIC_CURRENT_ENV",
      init() {},
      database() {
        throw new Error("Test must inject a fake database");
      },
      getWXContext() {
        throw new Error("Test must inject a fake WeChat context");
      },
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

test("mini program registers the M1 product routes and environment", () => {
  const appConfig = readJson("miniprogram/app.json");
  const expectedPages = [
    "pages/home/index",
    "pages/upload/index",
    "pages/preferences/index",
    "pages/generating/index",
    "pages/preview/index",
    "pages/payment-result/index",
    "pages/report/index",
    "pages/my-reports/index",
    "pages/share/index",
    "pages/privacy/index",
    "pages/refund-help/index",
  ];

  assert.deepStrictEqual(appConfig.pages, expectedPages);

  const constants = require("../miniprogram/utils/constants");
  assert.strictEqual(constants.CLOUD_ENV_ID, "newhzapp-d4g8fk4yiaa3fa679");

  const appJs = readText("miniprogram/app.js");
  assert.match(appJs, /env:\s*CLOUD_ENV_ID/);

  const envList = require("../miniprogram/envList");
  assert.deepStrictEqual(envList.envList, [
    {
      envId: "newhzapp-d4g8fk4yiaa3fa679",
      alias: "newhzapp",
    },
  ]);
});

test("front end exposes service and utility boundaries without direct database access", () => {
  for (const service of ["auth", "test", "report", "payment", "share"]) {
    const servicePath = `miniprogram/services/${service}.js`;
    assert.ok(exists(servicePath), `${servicePath} should exist`);
    const source = readText(servicePath);
    assert.doesNotMatch(source, /wx\.cloud\.database\s*\(/);
    assert.match(source, /callBusinessFunction\s*\(/);
  }

  const cloudService = readText("miniprogram/services/cloud.js");
  assert.match(cloudService, /wx\.cloud\.callFunction\s*\(/);

  for (const utility of ["constants", "errors"]) {
    assert.ok(exists(`miniprogram/utils/${utility}.js`));
  }
});

test("user cloud function silently logs in and upserts users through OPENID", async () => {
  const userFunction = require("../cloudfunctions/user");

  const calls = [];
  const fakeDb = {
    collection(name) {
      calls.push(["collection", name]);
      assert.strictEqual(name, "users");
      return {
        where(query) {
          calls.push(["where", query]);
          return {
            async get() {
              calls.push(["get"]);
              return { data: [] };
            },
            async update(payload) {
              calls.push(["update", payload]);
              return { stats: { updated: 1 } };
            },
          };
        },
        async add(payload) {
          calls.push(["add", payload]);
          return { _id: "user-1" };
        },
      };
    },
  };

  const result = await userFunction.main(
    { action: "silentLogin" },
    {},
    {
      db: fakeDb,
      wxContext: {
        OPENID: "openid-123",
        APPID: "appid-123",
        UNIONID: "unionid-123",
      },
      now: () => new Date("2026-06-13T08:00:00.000Z"),
    }
  );

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(result.data, {
    openid: "openid-123",
    appid: "appid-123",
    unionid: "unionid-123",
    isNewUser: true,
  });
  assert.deepStrictEqual(calls[0], ["collection", "users"]);
  assert.deepStrictEqual(calls[1], ["where", { openid: "openid-123" }]);
  assert.strictEqual(calls[3][0], "add");
});

test("business cloud function skeletons exist by domain", () => {
  for (const functionName of [
    "user",
    "test",
    "report",
    "payment",
    "share",
    "cleanupExpiredData",
  ]) {
    assert.ok(exists(`cloudfunctions/${functionName}/index.js`));
    assert.ok(exists(`cloudfunctions/${functionName}/package.json`));
  }

  assert.ok(exists("cloudfunctions/quickstartFunctions/README.md"));
});
