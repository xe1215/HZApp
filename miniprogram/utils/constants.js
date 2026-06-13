const CLOUD_ENV_ID = "newhzapp-d4g8fk4yiaa3fa679";

const PRICE = {
  REPORT_UNLOCK_CENTS: 599,
  CURRENCY: "CNY",
};

const TEST_STATUS = {
  DRAFT: "draft",
  GENERATING: "generating",
  PREVIEW_READY: "preview_ready",
  PAID: "paid",
  FAILED: "failed",
};

const REPORT_STATUS = {
  ACTIVE: "active",
  REPLACED: "replaced",
  UNLOCKED: "unlocked",
  DELETED: "deleted",
  EXPIRED: "expired",
};

const LIMITS = {
  MAX_PREVIEW_REGENERATE_COUNT: 3,
};

module.exports = {
  CLOUD_ENV_ID,
  PRICE,
  TEST_STATUS,
  REPORT_STATUS,
  LIMITS,
};
