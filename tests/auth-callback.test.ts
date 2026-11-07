import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/auth-callback.html", import.meta.url), "utf8");
const debugPage = readFileSync(new URL("../public/debug.html", import.meta.url), "utf8");
const callbackPage = readFileSync(
  new URL("../src/app/auth/callback/page.tsx", import.meta.url),
  "utf8"
);

test("auth callback never dumps URL/session secrets into the DOM", () => {
  assert.doesNotMatch(html, /sessionStorage/);
  assert.doesNotMatch(html, /JSON\.stringify\([^)]*\)\s*\}\s*<\/pre>/);
  assert.doesNotMatch(html, /dump\(/);
  assert.doesNotMatch(html, /accessToken\.substring/);
  assert.doesNotMatch(html, /refresh_token[^\n]*innerHTML/);
});

test("auth callback sends PKCE codes to the app, not to /debug.html", () => {
  assert.doesNotMatch(html, /debug\.html/);
  assert.match(html, /window\.location\.replace\("\/auth\/callback"/);
});

test("auth callback derives the Supabase project ref instead of hardcoding it", () => {
  assert.doesNotMatch(html, /vmqbslghzgfotwhzgawa/);
  assert.match(html, /projectRefFromToken/);
  assert.match(html, /payload\.iss/);
});

test("auth callback keeps the implicit-flow token storage path", () => {
  assert.match(html, /access_token/);
  assert.match(html, /localStorage\.setItem\("sb-" \+ ref \+ "-auth-token"/);
});

test("the Next callback page never renders debug lines or code prefixes", () => {
  assert.doesNotMatch(callbackPage, /\bdebug\b/i);
  assert.doesNotMatch(callbackPage, /setDebug/);
  assert.doesNotMatch(callbackPage, /code\.substring/);
  assert.doesNotMatch(callbackPage, /Code found/);
  assert.doesNotMatch(callbackPage, /Params:/);
});

test("debug.html never hardcodes the Supabase project ref", () => {
  assert.doesNotMatch(debugPage, /vmqbslghzgfotwhzgawa/);
  assert.match(debugPage, /projectRefFromStorage/);
});

test("debug.html lists storage and cookie names without exposing values", () => {
  assert.doesNotMatch(debugPage, /access_token/);
  assert.doesNotMatch(debugPage, /refresh_token/);
  assert.doesNotMatch(debugPage, /localStorage\.getItem/);
  assert.doesNotMatch(debugPage, /el\('cookies'\)\.textContent = document\.cookie/);
  assert.doesNotMatch(debugPage, /window\.location\.hash\s*\|\|/);
  assert.doesNotMatch(debugPage, /el\('url'\)\.textContent = window\.location\.href/);
  assert.match(debugPage, /\(hodnoty se nikdy nezobrazují\)/);
  assert.match(debugPage, /hash přítomen/);
});
