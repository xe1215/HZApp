Page({
  data: {
    skinTone: "neutral",
    budget: "mid",
    scene: "daily",
    style: "natural",
  },

  startGenerating() {
    wx.navigateTo({ url: "/pages/generating/index" });
  },
});
