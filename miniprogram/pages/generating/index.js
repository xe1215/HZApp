Page({
  onLoad() {
    setTimeout(() => {
      wx.redirectTo({ url: "/pages/preview/index" });
    }, 800);
  },
});
