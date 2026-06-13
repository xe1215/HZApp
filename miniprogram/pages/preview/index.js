Page({
  unlockReport() {
    wx.navigateTo({ url: "/pages/payment-result/index" });
  },

  regeneratePreview() {
    wx.showToast({
      title: "Refresh queued",
      icon: "none",
    });
  },
});
