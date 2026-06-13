const ERROR_CODES = {
  UNKNOWN: "UNKNOWN",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  INVALID_ACTION: "INVALID_ACTION",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  REPORT_LOCKED: "REPORT_LOCKED",
  PREVIEW_REGENERATE_LIMIT: "PREVIEW_REGENERATE_LIMIT",
  SELFIE_REJECTED: "SELFIE_REJECTED",
};

const ERROR_MESSAGES = {
  [ERROR_CODES.UNKNOWN]: "Something went wrong. Please try again.",
  [ERROR_CODES.LOGIN_REQUIRED]: "Please reopen the mini program and try again.",
  [ERROR_CODES.INVALID_ACTION]: "This action is not supported yet.",
  [ERROR_CODES.INVALID_PAYLOAD]: "Some required information is missing.",
  [ERROR_CODES.REPORT_LOCKED]: "Unlock the report before viewing full details.",
  [ERROR_CODES.PREVIEW_REGENERATE_LIMIT]: "No free color refreshes remain for this test.",
  [ERROR_CODES.SELFIE_REJECTED]: "This photo cannot be used. Please retake it with a clear face and visible lips.",
};

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
};
