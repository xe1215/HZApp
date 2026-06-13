const { callBusinessFunction } = require("./cloud");

function silentLogin() {
  return callBusinessFunction("user", "silentLogin");
}

module.exports = {
  silentLogin,
};
