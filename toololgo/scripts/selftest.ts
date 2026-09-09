/* Node runner for the acceptance tests (section 57) + 100,000 row probe (section 46). */
import { runSelfTests, runPerformanceTest } from '../src/lib/selftest';

const results = runSelfTests();
let failed = 0;
for (const r of results) {
  if (!r.passed) failed++;
  console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name}  ${r.detail}`);
}
const perf = runPerformanceTest(100000);
if (!perf.passed) failed++;
console.log(`${perf.passed ? 'PASS' : 'FAIL'}  11. ${perf.name}  ${perf.detail}`);
console.log(failed === 0 ? '\nALL ACCEPTANCE TESTS PASSED' : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
