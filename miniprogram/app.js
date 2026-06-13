const { CLOUD_ENV_ID } = require("./utils/constants");

App({
  onLaunch() {
    this.globalData = {
      env: CLOUD_ENV_ID,
      user: null,
    };

    if (!wx.cloud) {
      console.error("Please use base library 2.2.3 or later for cloud capabilities");
      return;
    }

    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });
  },
});
