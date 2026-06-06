import assert from "node:assert/strict";
import test from "node:test";
import { type TestFunctionContext, main as testMain } from "../cloudfunctions/user/test/index.js";
import type { Report } from "../shared/types/report.js";
import type { Lipstick, Preferences, TryOnTest } from "../shared/types/test.js";

test("提交偏好后按可解释规则推荐 Top 3 并创建报告快照", async () => {
  const updatedTests: Array<{ testId: string; patch: Partial<TryOnTest> }> = [];
  const addedReports: Report[] = [];
  const context = createPreferenceContext({
    catalog: lipstickCatalog,
    onTestPatch: (testId, patch) => updatedTests.push({ testId, patch }),
    onReport: (report) => addedReports.push(report),
  });

  const preferences: Preferences = {
    skinTone: "fair",
    budgetRange: "mid",
    scenes: ["commute"],
    styles: ["brightening"],
  };

  const result = await testMain(
    {
      action: "submitPreferences",
      testId: "test-001",
      preferences,
    },
    context,
  );

  assert.equal(result.ok, true);
  assert.equal(result.reportId, "report-001");
  assert.deepEqual(
    result.recommendations.map((item) => item.lipstickId),
    ["lip-1", "lip-2", "lip-3"],
  );
  assert.deepEqual(updatedTests, [
    {
      testId: "test-001",
      patch: {
        preferences,
        activeReportId: "report-001",
        updatedAt: "2026-06-03T10:00:00.000Z",
      },
    },
  ]);
  assert.equal(addedReports.length, 1);
  assert.equal(addedReports[0].openid, "openid-001");
  assert.equal(addedReports[0].testId, "test-001");
  assert.equal(addedReports[0].version, 1);
  assert.equal(addedReports[0].status, "active");
  assert.deepEqual(
    addedReports[0].snapshot.recommendations.map((item) => item.lipstickId),
    ["lip-1", "lip-2", "lip-3"],
  );
});

test("推荐结果包含完整报告展示所需字段", async () => {
  const context = createPreferenceContext({
    catalog: lipstickCatalog,
    onReport: () => undefined,
  });

  const result = await testMain(
    {
      action: "submitPreferences",
      testId: "test-001",
      preferences: {
        skinTone: "fair",
        budgetRange: "mid",
        scenes: ["commute"],
        styles: ["brightening"],
      },
    },
    context,
  );

  assert.deepEqual(result.recommendations[0], {
    lipstickId: "lip-1",
    brand: "品牌 lip-1",
    shadeName: "色号 lip-1",
    shadeCode: "LIP-1",
    colorHex: "#cc3355",
    swatchImageFileId: "cloud://swatches/lip-1.jpg",
    texture: "cream",
    undertone: "neutral",
    budgetRange: "mid",
    recommendationReason: "lip-1 推荐理由",
    cautionNote: "lip-1 避雷点",
    substitute: "lip-1 平替",
    searchKeywords: ["lip-1 搜索词"],
    score: 110,
  });
});

test("口红库通过 CloudBase 集合维护，未上架色号不会进入推荐", async () => {
  const catalogWithInactive = [
    lipstick("inactive-lip", {
      skinToneTags: ["fair"],
      budgetRange: "mid",
      sceneTags: ["commute"],
      styleTags: ["brightening"],
      baseScore: 999,
      manualBoost: 999,
      status: "inactive",
    }),
    ...lipstickCatalog,
  ];
  const context = createPreferenceContext({
    catalog: catalogWithInactive,
    onReport: () => undefined,
  });

  const result = await testMain(
    {
      action: "submitPreferences",
      testId: "test-001",
      preferences: {
        skinTone: "fair",
        budgetRange: "mid",
        scenes: ["commute"],
        styles: ["brightening"],
      },
    },
    context,
  );

  assert.deepEqual(
    result.recommendations.map((item) => item.lipstickId),
    ["lip-1", "lip-2", "lip-3"],
  );
});

test("报告 snapshot 不会被后续口红库对象修改影响", async () => {
  const mutableCatalog = [
    lipstick("lip-1", {
      skinToneTags: ["fair"],
      budgetRange: "mid",
      sceneTags: ["commute"],
      styleTags: ["brightening"],
      baseScore: 80,
      manualBoost: 10,
    }),
    ...lipstickCatalog.slice(1),
  ];
  const addedReports: Report[] = [];
  const context = createPreferenceContext({
    catalog: mutableCatalog,
    onReport: (report) => addedReports.push(report),
  });

  await testMain(
    {
      action: "submitPreferences",
      testId: "test-001",
      preferences: {
        skinTone: "fair",
        budgetRange: "mid",
        scenes: ["commute"],
        styles: ["brightening"],
      },
    },
    context,
  );

  mutableCatalog[0].searchKeywords.push("后续新增关键词");
  mutableCatalog[0].recommendationReason = "后续修改后的推荐理由";

  assert.equal(addedReports[0].snapshot.recommendations[0].recommendationReason, "lip-1 推荐理由");
  assert.deepEqual(addedReports[0].snapshot.recommendations[0].searchKeywords, ["lip-1 搜索词"]);
});

const existingTest: TryOnTest = {
  _id: "test-001",
  openid: "openid-001",
  status: "selfie_uploaded",
  selfieFileId: "cloud://selfies/openid-001/test-001/original.jpg",
  preferences: null,
  safetyStatus: "passed",
  qualityStatus: "passed",
  generationStatus: "pending",
  generationRetryCount: 0,
  previewRegenerateCount: 0,
  maxPreviewRegenerateCount: 3,
  activeReportId: null,
  sourceShareId: null,
  createdAt: "2026-06-03T09:00:00.000Z",
  updatedAt: "2026-06-03T09:00:00.000Z",
  expiresAt: "2026-06-04T09:00:00.000Z",
};

const lipstickCatalog: Lipstick[] = [
  lipstick("lip-1", {
    skinToneTags: ["fair"],
    budgetRange: "mid",
    sceneTags: ["commute"],
    styleTags: ["brightening"],
    baseScore: 80,
    manualBoost: 10,
  }),
  lipstick("lip-2", {
    skinToneTags: ["fair"],
    budgetRange: "mid",
    sceneTags: ["commute"],
    styleTags: [],
    baseScore: 82,
    manualBoost: 6,
  }),
  lipstick("lip-3", {
    skinToneTags: ["fair"],
    budgetRange: "mid",
    sceneTags: [],
    styleTags: ["brightening"],
    baseScore: 81,
    manualBoost: 4,
  }),
  lipstick("lip-4", {
    skinToneTags: ["fair"],
    budgetRange: "luxury",
    sceneTags: ["commute"],
    styleTags: ["brightening"],
    baseScore: 99,
    manualBoost: 99,
  }),
];

function createPreferenceContext(options: {
  catalog: Lipstick[];
  onTestPatch?: (testId: string, patch: Partial<TryOnTest>) => void;
  onReport: (report: Report) => void;
}): TestFunctionContext {
  return {
    openid: "openid-001",
    now: "2026-06-03T10:00:00.000Z",
    storage: {
      async upload() {
        throw new Error("not used");
      },
    },
    database: {
      async addTryOnTest() {
        throw new Error("not used");
      },
      async getTryOnTest(testId) {
        assert.equal(testId, "test-001");

        return existingTest;
      },
      async listActiveLipsticks() {
        return options.catalog;
      },
      async updateTryOnTest(testId, patch) {
        options.onTestPatch?.(testId, patch);
      },
      async addReport(report) {
        options.onReport(report);

        return { id: report._id };
      },
    },
    idGenerator: () => "report-001",
  };
}

function lipstick(
  _id: string,
  overrides: Pick<Lipstick, "skinToneTags" | "budgetRange" | "sceneTags" | "styleTags" | "baseScore" | "manualBoost"> & Partial<Pick<Lipstick, "status">>,
): Lipstick {
  return {
    _id,
    brand: `品牌 ${_id}`,
    shadeName: `色号 ${_id}`,
    shadeCode: _id.toUpperCase(),
    colorHex: "#cc3355",
    swatchImageFileId: `cloud://swatches/${_id}.jpg`,
    texture: "cream",
    undertone: "neutral",
    recommendationReason: `${_id} 推荐理由`,
    cautionNote: `${_id} 避雷点`,
    substitute: `${_id} 平替`,
    searchKeywords: [`${_id} 搜索词`],
    status: "active",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}
