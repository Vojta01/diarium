import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const statsDir = new URL("../src/components/stats/", import.meta.url);
const components = readdirSync(statsDir)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => `../src/components/stats/${file}`);

test("the timeline chart is an image with a description and a table equivalent", () => {
  const timeline = source("../src/components/stats/MetricTimelineCard.tsx");
  assert.match(timeline, /role="img"/);
  assert.match(timeline, /aria-label=/);
  assert.match(timeline, /className="sr-only"[\s\S]{0,200}<table/);
  assert.match(timeline, /<caption>/);
  assert.match(timeline, /type="range"/);
  assert.match(timeline, /aria-valuetext=/);
});

test("the timeline slider announces the selected date with its values", () => {
  const timeline = source("../src/components/stats/MetricTimelineCard.tsx");
  assert.match(
    timeline,
    /const sliderValueText = `\$\{formatDayLabel\(sliderDate, lang\)\} — \$\{valuesFor\(sliderDate\)\}`;/
  );
  assert.match(timeline, /aria-valuetext=\{sliderValueText\}/);
});

test("every stats component uses real 44px buttons", () => {
  for (const file of components) {
    const component = source(file);
    if (!component.includes("<button")) continue;
    assert.match(component, /type="button"/, `${file} must use real buttons`);
    assert.match(component, /min-h-11/, `${file} must keep 44px targets`);
  }
});

test("stats components import no chart library", () => {
  for (const file of components) {
    const component = source(file);
    assert.doesNotMatch(
      component,
      /from "(recharts|d3|chart\.js|victory|@nivo\/[^"]+)"/,
      `${file} must stay on inline SVG/CSS`
    );
  }
});

test("the new engine is pure: no Date.now and no p-values or stars", () => {
  const analysisDir = new URL("../src/lib/analysis/", import.meta.url);
  for (const file of readdirSync(analysisDir).filter((name) => name.endsWith(".ts"))) {
    const code = source(`../src/lib/analysis/${file}`);
    assert.doesNotMatch(code, /Date\.now\(/, `${file} must not read the clock`);
    assert.doesNotMatch(
      code,
      /p[-_ ]?value|cohen|significance|\*\*\*/i,
      `${file} must not reintroduce significance theatre`
    );
  }
});

test("comparison tiles call absent metric readings no data, not not-tracked", () => {
  const comparison = source("../src/components/stats/PeriodComparisonCard.tsx");
  assert.ok(comparison.includes('t("analysis.compare.no_data")'));
  assert.equal(comparison.includes('t("analysis.compare.not_tracked")'), false);
});

test("the analysis read is bounded to 180 days and never unbounded", () => {
  const section = source("../src/components/stats/AnalysisSection.tsx");
  assert.match(section, /const ANALYSIS_READ_DAYS = 180/);
  assert.match(section, /fetchDailyEntries\(\{ from, to: today \}\)/);
});
