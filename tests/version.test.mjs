import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareVersions,
  isNewerVersion,
  parseVersion,
  isDistributionVersion,
} from "../src/utils/version.ts";

test("fork revisions and upstream migrations are ordered numerically", () => {
  for (const [newer, older] of [
    ["1.3.2-fork.1", "1.3.2"],
    ["1.3.2-fork.2", "v1.3.2-fork.1"],
    ["1.3.2-fork.10", "1.3.2-fork.9"],
    ["1.3.3-fork.1", "1.3.2-fork.99"],
  ]) {
    assert.equal(isNewerVersion(newer, older), true);
    assert.equal(isNewerVersion(older, newer), false);
  }
});
test("same version and build metadata never trigger an update", () => {
  assert.equal(compareVersions("v1.3.2-fork.1+a", "1.3.2-fork.1+b"), 0);
  assert.equal(isNewerVersion("1.3.2", "1.3.2"), false);
});
test("development and invalid versions are excluded", () => {
  for (const value of [
    "dev",
    "Snapshot-123",
    "1.3.2-beta.1",
    "1.3.2-fork.0",
    "1.3.2junk",
    "1.3",
    "01.3.2",
    null,
  ]) {
    assert.equal(parseVersion(value), null);
    assert.equal(isNewerVersion(value, "1.3.2"), false);
    assert.equal(isNewerVersion("1.3.2-fork.1", value), false);
  }
});
test("out-of-order GitHub release responses select the newest revision", () => {
  assert.deepEqual(
    ["1.3.2-fork.2", "1.3.2-fork.10", "1.3.2-fork.1"].sort((a, b) =>
      compareVersions(b, a),
    ),
    ["1.3.2-fork.10", "1.3.2-fork.2", "1.3.2-fork.1"],
  );
});

test("independent releases accept only stable numeric versions starting at 1.2.4", () => {
  const tags = [
    "1.3.2-fork.100",
    "1.2.3-fork.3",
    "1.2.13-fork.2",
    "1.2.3",
    "1.2.4",
    "1.2.10",
    "1.3.0",
    "v1.2.5",
    "1.2.5-beta.1",
    "1.2.5+build",
    "01.2.5",
  ];
  assert.deepEqual(
    tags.filter(isDistributionVersion).sort((a, b) => compareVersions(b, a)),
    ["1.3.0", "1.2.10", "1.2.4"],
  );
  assert.equal(isNewerVersion("1.2.4", "1.2.3-fork.3"), true);
  assert.equal(isNewerVersion("1.2.10", "1.2.9"), true);
  assert.equal(isNewerVersion("1.2.4", "1.2.5"), false);
});
