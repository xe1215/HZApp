const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RECOMMENDATION_LIMIT = 3;

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
  return {
    code: "INVALID_ACTION",
    message: `Unsupported action: ${action || "unknown"}`,
    data: null,
  };
}

function getRuntime(deps) {
  return {
    db: deps && deps.db ? deps.db : cloud.database(),
    wxContext: deps && deps.wxContext ? deps.wxContext : cloud.getWXContext(),
    now: deps && deps.now ? deps.now : () => new Date(),
    id:
      deps && deps.id
        ? deps.id
        : () => `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    moveFile:
      deps && deps.moveFile
        ? deps.moveFile
        : async ({ from, to }) => {
            const download = await cloud.downloadFile({ fileID: from });
            const upload = await cloud.uploadFile({
              cloudPath: to,
              fileContent: download.fileContent,
            });
            await cloud.deleteFile({ fileList: [from] });
            return upload;
          },
  };
}

function inspectSelfie(checks) {
  const normalized = checks || {};
  const reasons = [];

  if (normalized.contentSafe === false) {
    reasons.push("content_unsafe");
  }

  if (normalized.faceDetected === false) {
    reasons.push("face_missing");
  }

  if (normalized.lipsVisible === false) {
    reasons.push("lips_not_visible");
  }

  if (Number(normalized.blurScore || 0) > 0.7) {
    reasons.push("image_blurry");
  }

  if (Number(normalized.occlusionScore || 0) > 0.6) {
    reasons.push("face_occluded");
  }

  return {
    passed: reasons.length === 0,
    reasons,
    safetyStatus: reasons.includes("content_unsafe") ? "rejected" : "passed",
    qualityStatus: reasons.length > (reasons.includes("content_unsafe") ? 1 : 0) ? "rejected" : "passed",
  };
}

function includesValue(values, expected) {
  if (!expected) {
    return false;
  }

  if (Array.isArray(values)) {
    return values.includes(expected);
  }

  return values === expected;
}

function getBudget(item) {
  return item.budgetRange || item.priceRange || "";
}

function scoreLipstick(item, preferences) {
  let score = Number(item.manualBoost || 0);

  if (includesValue(item.skinToneTags, preferences.skinTone)) {
    score += 100;
  }

  if (includesValue(item.sceneTags, preferences.scene)) {
    score += 20;
  }

  if (includesValue(item.styleTags, preferences.style)) {
    score += 10;
  }

  return score;
}

function toRecommendationSnapshot(item, rank, preferences) {
  return {
    rank,
    lipstickId: item._id,
    brand: item.brand || "",
    shadeName: item.shadeName || "",
    shadeCode: item.shadeCode || "",
    colorHex: item.colorHex || "",
    priceRange: item.priceRange || item.budgetRange || "",
    skinToneTags: item.skinToneTags || [],
    budgetRange: item.budgetRange || "",
    sceneTags: item.sceneTags || [],
    styleTags: item.styleTags || [],
    manualBoost: Number(item.manualBoost || 0),
    recommendationReason: item.recommendationReason || "",
    cautionNote: item.cautionNote || "",
    substitute: item.substitute || "",
    searchKeywords: item.searchKeywords || [],
    matchedPreferences: {
      skinTone: preferences.skinTone,
      budget: preferences.budget,
      scene: preferences.scene,
      style: preferences.style,
    },
  };
}

function rankLipsticks(lipsticks, preferences) {
  return lipsticks
    .filter((item) => item.status === "active")
    .filter((item) => includesValue(getBudget(item), preferences.budget))
    .map((item) => ({
      item,
      score: scoreLipstick(item, preferences),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return String(a.item._id).localeCompare(String(b.item._id));
    })
    .slice(0, RECOMMENDATION_LIMIT)
    .map((entry, index) =>
      toRecommendationSnapshot(entry.item, index + 1, preferences)
    );
}

function validatePreferences(data) {
  const preferences = data && data.preferences;

  if (!data || !data.testId || !preferences) {
    return null;
  }

  const required = ["skinTone", "budget", "scene", "style"];
  for (const field of required) {
    if (!preferences[field]) {
      return null;
    }
  }

  return {
    skinTone: preferences.skinTone,
    budget: preferences.budget,
    scene: preferences.scene,
    style: preferences.style,
  };
}

async function uploadSelfie(event, deps) {
  const data = (event && event.data) || {};
  const runtime = getRuntime(deps);
  const openid = runtime.wxContext && runtime.wxContext.OPENID;

  if (!openid) {
    return fail("LOGIN_REQUIRED", "OPENID is missing from WeChat context");
  }

  if (!data.tempFileID) {
    return fail("INVALID_PAYLOAD", "tempFileID is required");
  }

  const inspection = inspectSelfie(data.checks);

  if (!inspection.passed) {
    return fail("SELFIE_REJECTED", "Selfie did not pass safety or quality checks", {
      reasons: inspection.reasons,
      safetyStatus: inspection.safetyStatus,
      qualityStatus: inspection.qualityStatus,
    });
  }

  const nowDate = runtime.now();
  const now = nowDate.toISOString();
  const expiresAt = new Date(nowDate.getTime() + ONE_DAY_MS).toISOString();
  const testId = data.testId || runtime.id();
  const privatePath = `selfies/${openid}/${testId}/original.jpg`;
  const moved = await runtime.moveFile({
    from: data.tempFileID,
    to: privatePath,
  });
  const selfieFileId = moved.fileID;

  const testRecord = {
    _id: testId,
    openid,
    status: "selfie_uploaded",
    selfieFileId,
    safetyStatus: inspection.safetyStatus,
    qualityStatus: inspection.qualityStatus,
    generationStatus: "pending",
    previewRegenerateCount: 0,
    maxPreviewRegenerateCount: 3,
    activeReportId: "",
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  await runtime.db.collection("try_on_tests").add({
    data: testRecord,
  });

  await runtime.db.collection("events").add({
    data: {
      type: "upload_selfie_success",
      openid,
      testId,
      selfieFileId,
      createdAt: now,
    },
  });

  return ok({
    testId,
    selfieFileId,
    safetyStatus: inspection.safetyStatus,
    qualityStatus: inspection.qualityStatus,
    expiresAt,
  });
}

async function submitPreferences(event, deps) {
  const data = (event && event.data) || {};
  const preferences = validatePreferences(data);
  const runtime = getRuntime(deps);
  const openid = runtime.wxContext && runtime.wxContext.OPENID;

  if (!openid) {
    return fail("LOGIN_REQUIRED", "OPENID is missing from WeChat context");
  }

  if (!preferences) {
    return fail("INVALID_PAYLOAD", "testId and complete preferences are required");
  }

  const now = runtime.now().toISOString();
  const lipsticksResult = await runtime.db
    .collection("lipsticks")
    .where({ status: "active" })
    .get();
  const recommendations = rankLipsticks(lipsticksResult.data || [], preferences);

  if (recommendations.length < RECOMMENDATION_LIMIT) {
    return fail("RECOMMENDATION_NOT_ENOUGH", "Not enough active lipsticks matched preferences", {
      recommendations,
    });
  }

  const reportPayload = {
    openid,
    testId: data.testId,
    version: 1,
    status: "active",
    snapshot: {
      preferences,
      recommendations,
      generatedAt: now,
    },
    previewImages: [],
    paidImages: [],
    shareCardImages: [],
    replacedByReportId: "",
    unlockedAt: "",
    expiresAt: "",
    deletedAt: "",
    createdAt: now,
  };
  const report = await runtime.db.collection("reports").add({
    data: reportPayload,
  });
  const reportId = report._id;

  await runtime.db.collection("try_on_tests").doc(data.testId).update({
    data: {
      preferences,
      status: "preferences_submitted",
      generationStatus: "recommendation_ready",
      activeReportId: reportId,
      updatedAt: now,
    },
  });

  await runtime.db.collection("events").add({
    data: {
      type: "preference_submit",
      openid,
      testId: data.testId,
      reportId,
      preferences,
      createdAt: now,
    },
  });

  return ok({
    testId: data.testId,
    reportId,
    recommendations,
  });
}

async function main(event, context, deps) {
  const action = event && event.action;

  if (action === "createTest") {
    return ok({ status: "draft" });
  }

  if (action === "uploadSelfie") {
    return await uploadSelfie(event, deps);
  }

  if (action === "submitPreferences") {
    return await submitPreferences(event, deps);
  }

  if (action === "regeneratePreview") {
    return ok({ status: "preview_refresh_queued" });
  }

  return unsupported(action);
}

exports.main = main;
exports.uploadSelfie = uploadSelfie;
exports.submitPreferences = submitPreferences;
exports.inspectSelfie = inspectSelfie;
exports.rankLipsticks = rankLipsticks;
