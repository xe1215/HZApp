const { CLOUD_ENV_ID } = require("./utils/constants");

const envList = [
  {
    envId: CLOUD_ENV_ID,
    alias: "newhzapp",
  },
];

const isMac = false;

module.exports = {
  envList,
  isMac,
};
