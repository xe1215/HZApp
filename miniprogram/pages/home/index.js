const authService = require("../../services/auth");

Page({
  data: {
    userReady: false,
    loginError: "",
    steps: [
      "Upload a clear selfie",
      "Choose skin tone, budget, scene, and style",
      "Preview three watermarked lipstick looks",
      "Unlock the full report for 5.99 CNY",
    ],
  },

  onLoad() {
    this.bootstrapUser();
  },

  bootstrapUser() {
    authService
      .silentLogin()
      .then((response) => {
        const app = getApp();
        app.globalData.user = response.result && response.result.data;
        this.setData({ userReady: true, loginError: "" });
      })
      .catch(() => {
        this.setData({
          userReady: false,
          loginError: "Cloud login is not ready. Please try again later.",
        });
      });
  },

  startTest() {
    wx.navigateTo({
      url: "/pages/upload/index",
    });
  },

  openReports() {
    wx.navigateTo({
      url: "/pages/my-reports/index",
    });
  },
});
