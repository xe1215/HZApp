import assert from "node:assert/strict";
import test from "node:test";
import { type TestFunctionContext, main as testMain } from "../cloudfunctions/user/test/index.js";
import type { TryOnTest } from "../shared/types/test.js";

test("合格自拍上传后会创建一条试色测试记录", async () => {
  const savedFiles: Array<{ cloudPath: string; access: string }> = [];
  const insertedTests: TryOnTest[] = [];

  const context: TestFunctionContext = {
    openid: "openid-001",
    now: "2026-06-03T10:00:00.000Z",
    storage: {
      async upload(options) {
        savedFiles.push({
          cloudPath: options.cloudPath,
          access: options.access,
        });

        return {
          fileId: "cloud://selfies/openid-001/test-001/original.jpg",
        };
      },
    },
    database: {
      async addTryOnTest(record) {
        insertedTests.push(record);

        return {
          id: "test-001",
        };
      },
    },
    idGenerator: () => "test-001",
  };

  const result = await testMain(
    {
      action: "uploadSelfie",
      file: {
        name: "selfie.jpg",
        contentType: "image/jpeg",
        buffer: "base64-image-data",
      },
      checks: {
        contentSafe: true,
        faceDetected: true,
        imageClear: true,
        lipsVisible: true,
      },
    },
    context,
  );

  assert.equal(result.ok, true);
  assert.equal(result.testId, "test-001");
  assert.equal(result.selfieFileId, "cloud://selfies/openid-001/test-001/original.jpg");
  assert.deepEqual(savedFiles, [
    {
      cloudPath: "selfies/openid-001/test-001/original.jpg",
      access: "private",
    },
  ]);
  assert.equal(insertedTests.length, 1);
  assert.equal(insertedTests[0].openid, "openid-001");
  assert.equal(insertedTests[0].selfieFileId, result.selfieFileId);
  assert.equal(insertedTests[0].safetyStatus, "passed");
  assert.equal(insertedTests[0].qualityStatus, "passed");
  assert.equal(insertedTests[0].expiresAt, "2026-06-04T10:00:00.000Z");
});

test("自拍上传始终由云函数强制写入私有云存储", async () => {
  const savedFiles: Array<{ access: string; cloudPath: string }> = [];

  await testMain(
    {
      action: "uploadSelfie",
      file: {
        name: "selfie.jpg",
        contentType: "image/jpeg",
        buffer: "base64-image-data",
      },
      checks: {
        contentSafe: true,
        faceDetected: true,
        imageClear: true,
        lipsVisible: true,
      },
      requestedAccess: "public",
    },
    {
      openid: "openid-001",
      storage: {
        async upload(options) {
          savedFiles.push({
            access: options.access,
            cloudPath: options.cloudPath,
          });

          return {
            fileId: "cloud://selfies/openid-001/test-001/original.jpg",
          };
        },
      },
      database: {
        async addTryOnTest() {
          return {
            id: "test-001",
          };
        },
      },
      idGenerator: () => "test-001",
    },
  );

  assert.deepEqual(savedFiles, [
    {
      access: "private",
      cloudPath: "selfies/openid-001/test-001/original.jpg",
    },
  ]);
});

test("不合格自拍会被拦截并返回可理解的失败原因", async () => {
  const blockedCases = [
    {
      checks: { contentSafe: false, faceDetected: true, imageClear: true, lipsVisible: true },
      reason: "图片内容不符合要求，请更换自拍后重试",
    },
    {
      checks: { contentSafe: true, faceDetected: false, imageClear: true, lipsVisible: true },
      reason: "没有识别到清晰正脸，请重新拍摄",
    },
    {
      checks: { contentSafe: true, faceDetected: true, imageClear: false, lipsVisible: true },
      reason: "图片不够清晰，请使用自然光下的清晰自拍",
    },
    {
      checks: { contentSafe: true, faceDetected: true, imageClear: true, lipsVisible: false },
      reason: "没有识别到无遮挡嘴唇，请重新拍摄",
    },
  ];

  for (const blockedCase of blockedCases) {
    let uploadCalled = false;
    let insertCalled = false;

    const result = await testMain(
      {
        action: "uploadSelfie",
        file: {
          name: "selfie.jpg",
          contentType: "image/jpeg",
          buffer: "base64-image-data",
        },
        checks: blockedCase.checks,
      },
      {
        openid: "openid-001",
        storage: {
          async upload() {
            uploadCalled = true;
            return { fileId: "should-not-upload" };
          },
        },
        database: {
          async addTryOnTest() {
            insertCalled = true;
            return { id: "should-not-insert" };
          },
        },
      },
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, blockedCase.reason);
    assert.equal(uploadCalled, false);
    assert.equal(insertCalled, false);
  }
});
