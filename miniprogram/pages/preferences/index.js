const testService = require("../../services/test");
const { ERROR_MESSAGES } = require("../../utils/errors");

Page({
  data: {
    testId: "",
    skinTone: "neutral",
    budget: "mid",
    scene: "daily",
    style: "natural",
    submitting: false,
    feedback: "",
    options: {
      skinTone: [
        { value: "cool", label: "Cool" },
        { value: "neutral", label: "Neutral" },
        { value: "warm", label: "Warm" },
      ],
      budget: [
        { value: "low", label: "Low" },
        { value: "mid", label: "Mid" },
        { value: "high", label: "High" },
      ],
      scene: [
        { value: "daily", label: "Daily" },
        { value: "date", label: "Date" },
        { value: "commute", label: "Commute" },
      ],
      style: [
        { value: "natural", label: "Natural" },
        { value: "bold", label: "Bold" },
        { value: "commute", label: "Commute" },
      ],
    },
  },

  onLoad(query) {
    this.setData({
      testId: query && query.testId ? query.testId : "",
    });
  },

  selectOption(e) {
    const { field, value } = e.currentTarget.dataset;

    if (!field || !value) {
      return;
    }

    this.setData({
      [field]: value,
      feedback: "",
    });
  },

  startGenerating() {
    if (!this.data.testId) {
      this.setData({
        feedback: "Please upload a selfie before choosing preferences.",
      });
      return;
    }

    this.setData({
      submitting: true,
      feedback: "",
    });

    testService
      .submitPreferences({
        testId: this.data.testId,
        preferences: {
          skinTone: this.data.skinTone,
          budget: this.data.budget,
          scene: this.data.scene,
          style: this.data.style,
        },
      })
      .then((response) => {
        const result = response.result || {};

        if (result.code !== 0) {
          this.setData({
            submitting: false,
            feedback:
              result.message ||
              ERROR_MESSAGES[result.code] ||
              ERROR_MESSAGES.UNKNOWN,
          });
          return;
        }

        wx.navigateTo({
          url: `/pages/generating/index?testId=${result.data.testId}&reportId=${result.data.reportId}`,
        });
      })
      .catch(() => {
        this.setData({
          submitting: false,
          feedback: ERROR_MESSAGES.UNKNOWN,
        });
      });
  },
});
