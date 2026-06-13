const testService = require("../../services/test");
const { ERROR_MESSAGES } = require("../../utils/errors");

Page({
  data: {
    uploading: false,
    feedback: "",
  },

  chooseSelfie() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.tempFilePath) {
          this.setData({ feedback: "No photo was selected." });
          return;
        }

        this.uploadSelectedSelfie(file.tempFilePath);
      },
    });
  },

  uploadSelectedSelfie(tempFilePath) {
    const app = getApp();
    const openid =
      app.globalData && app.globalData.user && app.globalData.user.openid
        ? app.globalData.user.openid
        : "pending";
    const uploadPath = `uploads/${openid}/${Date.now()}-selfie.jpg`;

    this.setData({
      uploading: true,
      feedback: "Checking your selfie...",
    });

    wx.cloud
      .uploadFile({
        cloudPath: uploadPath,
        filePath: tempFilePath,
      })
      .then((uploadResult) => {
        return testService.uploadSelfie({
          tempFileID: uploadResult.fileID,
        });
      })
      .then((response) => {
        const result = response.result || {};
        if (result.code !== 0) {
          const message =
            result.message || ERROR_MESSAGES[result.code] || ERROR_MESSAGES.UNKNOWN;
          this.setData({
            uploading: false,
            feedback: message,
          });
          return;
        }

        wx.navigateTo({
          url: `/pages/preferences/index?testId=${result.data.testId}`,
        });
      })
      .catch(() => {
        this.setData({
          uploading: false,
          feedback: ERROR_MESSAGES.UNKNOWN,
        });
      });
  },
});
