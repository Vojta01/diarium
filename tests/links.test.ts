import assert from "node:assert/strict";
import test from "node:test";

import {
  ANDROID_APK_URL,
  GITHUB_ANDROID_URL,
  GITHUB_WEB_URL,
  LINKS,
} from "../src/lib/links.ts";

test("exposes the canonical web and Android GitHub repositories", () => {
  assert.equal(GITHUB_WEB_URL, "https://github.com/Vojta01/diarium");
  assert.equal(GITHUB_ANDROID_URL, "https://github.com/Vojta01/diarium-android");
  assert.equal(LINKS.githubWeb, GITHUB_WEB_URL);
  assert.equal(LINKS.githubAndroid, GITHUB_ANDROID_URL);
});

test("exposes the stable APK download on the apk branch", () => {
  assert.equal(
    ANDROID_APK_URL,
    "https://raw.githubusercontent.com/Vojta01/diarium-android/apk/diarium.apk"
  );
  assert.equal(LINKS.androidApk, ANDROID_APK_URL);
  assert.ok(ANDROID_APK_URL.endsWith(".apk"));
});

test("all public links are https and never point at a Vercel preview host", () => {
  for (const url of Object.values(LINKS)) {
    assert.ok(url.startsWith("https://"), `${url} must use https`);
    assert.ok(!url.includes("diarium.vercel.app"), `${url} must not use Vercel`);
  }
});
