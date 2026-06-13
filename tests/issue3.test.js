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

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((error) => {
      console.error(`not ok - ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

const lipsticks = [
  {
    _id: "inactive",
    status: "inactive",
    brand: "Hidden",
    shadeName: "Dormant",
    shadeCode: "H00",
    colorHex: "#111111",
    priceRange: "mid",
    skinToneTags: ["neutral"],
    budgetRange: "mid",
    sceneTags: ["daily"],
    styleTags: ["natural"],
    manualBoost: 99,
  },
  {
    _id: "best",
    status: "active",
    brand: "Brand A",
    shadeName: "Rose Tea",
    shadeCode: "A01",
    colorHex: "#b84b65",
    priceRange: "mid",
    skinToneTags: ["neutral", "warm"],
    budgetRange: "mid",
    sceneTags: ["daily", "date"],
    styleTags: ["natural"],
    manualBoost: 8,
    recommendationReason: "Brightens neutral skin without overpowering daily makeup.",
    cautionNote: "May look muted under cool office light.",
    substitute: "Brand B Soft Rose",
    searchKeywords: ["rose tea lipstick", "daily rose"],
  },
  {
    _id: "second",
    status: "active",
    brand: "Brand C",
    shadeName: "Cocoa Pink",
    shadeCode: "C12",
    colorHex: "#9f5060",
    priceRange: "mid",
    skinToneTags: ["neutral"],
    budgetRange: "mid",
    sceneTags: ["daily"],
    styleTags: ["commute", "natural"],
    manualBoost: 3,
    recommendationReason: "Soft color for commuting and bare-face days.",
    cautionNote: "Layer lightly on dry lips.",
    substitute: "",
    searchKeywords: ["cocoa pink lipstick"],
  },
  {
    _id: "third",
    status: "active",
    brand: "Brand D",
    shadeName: "Clear Berry",
    shadeCode: "D08",
    colorHex: "#b33258",
    priceRange: "mid",
    skinToneTags: ["neutral"],
    budgetRange: "mid",
    sceneTags: ["date"],
    styleTags: ["natural"],
    manualBoost: 2,
    recommendationReason: "Adds a polished berry tone for date scenes.",
    cautionNote: "",
    substitute: "Brand E Berry",
    searchKeywords: ["clear berry lipstick"],
  },
  {
    _id: "wrong-budget",
    status: "active",
    brand: "Brand F",
    shadeName: "Luxury Red",
    shadeCode: "F99",
    colorHex: "#cc0033",
    priceRange: "high",
    skinToneTags: ["neutral"],
    budgetRange: "high",
    sceneTags: ["daily", "date"],
    styleTags: ["natural"],
    manualBoost: 100,
  },
];

function createFakeDb(calls) {
  return {
    collection(name) {
      calls.push(["collection", name]);
      return {
        where(query) {
          calls.push(["where", name, query]);
          return {
            async get() {
              calls.push(["get", name]);
              if (name === "lipsticks") {
                assert.deepStrictEqual(query, { status: "active" });
                return { data: lipsticks.filter((item) => item.status === "active") };
              }

              return { data: [] };
            },
          };
        },
        doc(id) {
          calls.push(["doc", name, id]);
          return {
            async update(payload) {
              calls.push(["doc.update", name, id, payload]);
              return { stats: { updated: 1 } };
            },
          };
        },
        async add(payload) {
          calls.push(["add", name, payload]);
          return { _id: name === "reports" ? "report-1" : `${name}-1` };
        },
      };
    },
  };
}

test("preference submission updates test, records event, ranks active lipsticks, and snapshots report", async () => {
  const testFunction = require("../cloudfunctions/test");
  const calls = [];
  const preferences = {
    skinTone: "neutral",
    budget: "mid",
    scene: "daily",
    style: "natural",
  };

  const result = await testFunction.main(
    {
      action: "submitPreferences",
      data: {
        testId: "test-abc",
        preferences,
      },
    },
    {},
    {
      db: createFakeDb(calls),
      wxContext: { OPENID: "openid-123" },
      now: () => new Date("2026-06-13T08:00:00.000Z"),
      id: () => "report-abc",
    }
  );

  assert.strictEqual(result.code, 0);
  assert.strictEqual(result.data.testId, "test-abc");
  assert.strictEqual(result.data.reportId, "report-1");
  assert.deepStrictEqual(
    result.data.recommendations.map((item) => item.lipstickId),
    ["best", "second", "third"]
  );
  assert.ok(result.data.recommendations.every((item) => item.brand && item.shadeCode));
  assert.ok(result.data.recommendations.every((item) => item.recommendationReason !== undefined));

  const testUpdate = calls.find((call) => call[0] === "doc.update" && call[1] === "try_on_tests");
  const reportAdd = calls.find((call) => call[0] === "add" && call[1] === "reports");
  const eventAdd = calls.find((call) => call[0] === "add" && call[1] === "events");

  assert.ok(testUpdate, "try_on_tests should be updated");
  assert.deepStrictEqual(testUpdate[3].data.preferences, preferences);
  assert.strictEqual(testUpdate[3].data.activeReportId, "report-1");
  assert.ok(reportAdd, "report snapshot should be created");
  assert.deepStrictEqual(reportAdd[2].data.snapshot.preferences, preferences);
  assert.strictEqual(reportAdd[2].data.snapshot.recommendations[0].lipstickId, "best");
  assert.ok(eventAdd, "preference submit event should be recorded");
  assert.strictEqual(eventAdd[2].data.type, "preference_submit");
});

test("preferences page submits user choices through the test service", () => {
  const page = readText("miniprogram/pages/preferences/index.js");
  const service = readText("miniprogram/services/test.js");

  assert.match(page, /submitPreferences\s*\(/);
  assert.match(page, /testId/);
  assert.doesNotMatch(page, /wx\.cloud\.database\s*\(/);
  assert.match(service, /function submitPreferences/);
  assert.match(service, /callBusinessFunction\("test", "submitPreferences"/);
});
