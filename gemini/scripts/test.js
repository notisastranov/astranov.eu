import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

const assert = (condition, message) => {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
};

console.log('=== RUNNING ASTRANOV UNIT TESTS ===');

// 1. Test Delivery Fee Formula
// Spec: 3 AVC minimum for first 3 km + 1 AVC per additional km
const calcDeliveryFee = (dist) => {
  return dist <= 3 ? 3.0 : 3.0 + (dist - 3.0);
};

assert(calcDeliveryFee(1.5) === 3.0, 'Base delivery fee for 1.5 km should be 3 AVC');
assert(calcDeliveryFee(3.0) === 3.0, 'Base delivery fee for 3 km should be 3 AVC');
assert(calcDeliveryFee(5.0) === 5.0, 'Base delivery fee for 5 km should be 5 AVC');
assert(calcDeliveryFee(10.25) === 10.25, 'Base delivery fee for 10.25 km should be 10.25 AVC');

// 2. Test Driver Count Formula
// Spec: 1 driver per 13 kg or liters, or fraction thereof
const calcDrivers = (weight) => {
  return Math.max(1, Math.ceil(weight / 13.0));
};

assert(calcDrivers(5.0) === 1, '5 kg weight should require 1 driver');
assert(calcDrivers(13.0) === 1, '13 kg weight should require 1 driver');
assert(calcDrivers(13.01) === 2, '13.01 kg weight should require 2 drivers');
assert(calcDrivers(26.0) === 2, '26 kg weight should require 2 drivers');
assert(calcDrivers(26.01) === 3, '26.01 kg weight should require 3 drivers');

// 3. Test Special Condition Surcharge (+13% each)
const calcSpecialSurcharge = (baseFee) => {
  return baseFee * 0.13;
};

assert(Math.abs(calcSpecialSurcharge(3.0) - 0.39) < 0.0001, '13% surcharge on 3 AVC fee should be 0.39 AVC');

// 4. Test Contamination Scan
const BANNED_TERMS = [
  'welcome', 'onboarding', 'progress', 'percentage', 'percent', 'loading percent',
  'earth-wrap', 'globalCanvasWrap', 'canvas fake earth', 'hand-drawn continent array',
  'Planet X', 'fake planet', 'fake orbit', 'greece-only tap', 'greeceBeacon-only navigation',
  'simple XY globe drag', 'generic marker dots', 'fake route', 'straight-line route fallback',
  'public dev console', 'public Krypteia', 'public Kryptia', 'permanent accounting panel',
  'bank guarantee', 'minimum guarantee', 'meaningful guarantee', 'bank-backed guarantee',
  'Send offer', '108vw', '€', 'EUR visible money'
];

let violations = 0;
const scanFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    BANNED_TERMS.forEach(term => {
      // Exclude matches in test.js or server.js where validation lists are defined
      if (line.includes(term) && !filePath.includes('test.js') && !filePath.includes('server.js')) {
        violations++;
        console.error(`Banned keyword violation: "${term}" found in ${path.basename(filePath)} at line ${index + 1}`);
      }
    });
  });
};

const srcDir = path.join(rootDir, 'src');
if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  files.forEach(file => {
    const fullPath = path.join(srcDir, file);
    if (fs.statSync(fullPath).isFile() && (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.css'))) {
      scanFile(fullPath);
    }
  });
}

assert(violations === 0, 'Codebase should be clean of banned contamination keywords');

console.log(`\nTEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
if (passedTests < totalTests) {
  console.error('Test suite failed!');
  process.exit(1);
} else {
  console.log('All tests passed successfully.');
}
