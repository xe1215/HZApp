function callBusinessFunction(name, action, data) {
  return wx.cloud.callFunction({
    name,
    data: {
      action,
      data: data || {},
    },
  });
}

module.exports = {
  callBusinessFunction,
};
