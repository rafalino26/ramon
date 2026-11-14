const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cameraFacing } = require("../.test-build/camera");

test("front ultra wide labels remain front-facing without reported facingMode", () => {
  const track = label => ({ label, getSettings: () => ({}) });
  assert.equal(cameraFacing(track("Front Ultra Wide Camera"), "environment"), "user");
  assert.equal(cameraFacing(track("Back Ultra Wide Camera"), "user"), "environment");
  assert.equal(cameraFacing(track("Camera 1"), "user"), "user");
  assert.equal(cameraFacing({ label: "Front", getSettings: () => ({ facingMode: "environment" }) }, "user"), "environment");
});
