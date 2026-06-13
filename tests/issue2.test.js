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
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

function createFakeDb(calls) {
  return {
    collection(name) {
      calls.push(["collection", name]);
      return {
        async add(payload) {
          calls.push(["add", name, payload]);
          return { _id: `${name}-1` };
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
      };
    },
  };
}

test("test cloud function accepts a qualified selfie and creates a private test record", async () => {
  const testFunction = require("../cloudfunctions/test");
  const calls = [];

  const result = await testFunction.main(
    {
      action: "uploadSelfie",
      data: {
        tempFileID: "cloud://tmp/selfie.jpg",
        checks: {
          contentSafe: true,
          faceDetected: true,
          lipsVisible: true,
          blurScore: 0.18,
          occlusionScore: 0.1,
        },
      },
    },
    {},
    {
      db: createFakeDb(calls),
      wxContext: { OPENID: "openid-123" },
      now: () => new Date("2026-06-13T08:00:00.000Z"),
      id: () => "test-abc",
      moveFile: async ({ from, to }) => {
        calls.push(["moveFile", from, to]);
        return { fileID: `cloud://${to}` };
      },
    }
  );

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(result.data, {
    testId: "test-abc",
    selfieFileId: "cloud://selfies/openid-123/test-abc/original.jpg",
    safetyStatus: "passed",
    qualityStatus: "passed",
    expiresAt: "2026-06-14T08:00:00.000Z",
  });
  assert.deepStrictEqual(calls[0], [
    "moveFile",
    "cloud://tmp/selfie.jpg",
    "selfies/openid-123/test-abc/original.jpg",
  ]);
  const testAdd = calls.find((call) => call[0] === "add" && call[1] === "try_on_tests");
  const eventAdd = calls.find((call) => call[0] === "add" && call[1] === "events");
  assert.ok(testAdd, "try_on_tests record should be created");
  assert.ok(eventAdd, "upload success event should be created");
  assert.strictEqual(testAdd[2].data.selfieFileId, result.data.selfieFileId);
  assert.strictEqual(eventAdd[2].data.type, "upload_selfie_success");
});

test("test cloud function rejects unsafe or low quality selfies with clear reasons", async () => {
  const testFunction = require("../cloudfunctions/test");
  const calls = [];

  const result = await testFunction.main(
    {
      action: "uploadSelfie",
      data: {
        tempFileID: "cloud://tmp/selfie.jpg",
        checks: {
          contentSafe: false,
          faceDetected: false,
          lipsVisible: false,
          blurScore: 0.9,
          occlusionScore: 0.8,
        },
      },
    },
    {},
    {
      db: createFakeDb(calls),
      wxContext: { OPENID: "openid-123" },
      now: () => new Date("2026-06-13T08:00:00.000Z"),
      id: () => "test-abc",
      moveFile: async () => {
        throw new Error("moveFile should not be called for rejected selfies");
      },
    }
  );

  assert.strictEqual(result.code, "SELFIE_REJECTED");
  assert.deepStrictEqual(result.data.reasons, [
    "content_unsafe",
    "face_missing",
    "lips_not_visible",
    "image_blurry",
    "face_occluded",
  ]);
  assert.strictEqual(calls.length, 0);
});

test("upload page stores selfie privately through cloud function after client upload", () => {
  const uploadPage = readText("miniprogram/pages/upload/index.js");
  const testService = readText("miniprogram/services/test.js");

  assert.match(uploadPage, /uploadFile\s*\(/);
  assert.match(uploadPage, /uploadSelfie\s*\(/);
  assert.doesNotMatch(uploadPage, /wx\.cloud\.database\s*\(/);
  assert.doesNotMatch(uploadPage, /cloudPath:\s*["']selfies\//);
  assert.match(testService, /function uploadSelfie/);
  assert.match(testService, /callBusinessFunction\("test", "uploadSelfie"/);
});
