import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/auth-callback.html", import.meta.url), "utf8");

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
