/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "widget",
  // Live Activity 위젯 → ActivityKit 필요
  frameworks: ["SwiftUI", "ActivityKit"],
  icon: 'https://github.com/expo.png',
  entitlements: { /* Add entitlements */ },
});