Page({
  chooseSelfie() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: () => {
        wx.navigateTo({ url: "/pages/preferences/index" });
      },
    });
  },
});
