import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';

// Transpile clothesMatcher.ts on the fly for zero-dependency Node test execution
const tsSource = fs.readFileSync(new URL('./clothesMatcher.ts', import.meta.url), 'utf8');
const jsOutput = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

const modUrl = `data:text/javascript;base64,${Buffer.from(jsOutput).toString('base64')}`;
const {
  buildInlineGarmentRows,
  hasPhysicalAdjustments,
  getPhysicalClothesSummary,
  toVerifyOrderPayload,
  extractScriptBundleName,
} = await import(modUrl);

test('buildInlineGarmentRows maps ordered clothes with service names and prices', () => {
  const rows = buildInlineGarmentRows(
    [
      { id: 10, clothType: 'Shirt', serviceId: 1, quantity: 3, unitPrice: 12, service: { id: 1, serviceName: 'Press / Ironing' } },
      { id: 11, clothType: 'Blazer', serviceId: 2, quantity: 1, unitPrice: 180, service: { id: 2, serviceName: 'Dry Cleaning' } },
    ],
    1,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].clothType, 'Shirt');
  assert.equal(rows[0].orderedQty, 3);
  assert.equal(rows[0].physicalQty, 3);
  assert.equal(rows[0].serviceName, 'Press / Ironing');
  assert.equal(hasPhysicalAdjustments(rows), false);
});

test('physical missing & extra adjustment calculates summary and strips 0-qty missing items from verify payload', () => {
  const rows = buildInlineGarmentRows(
    [
      { id: 10, clothType: 'Shirt', serviceId: 1, quantity: 3, service: { id: 1, serviceName: 'Press / Ironing' } },
      { id: 11, clothType: 'Blazer', serviceId: 2, quantity: 1, service: { id: 2, serviceName: 'Dry Cleaning' } },
    ],
    1,
  );

  // Customer gave 2 Shirts (-1 missing) and 0 Blazers (-1 missing)
  rows[0].physicalQty = 2;
  rows[0].matched = true;
  rows[1].physicalQty = 0;

  assert.equal(hasPhysicalAdjustments(rows), true);

  const summary = getPhysicalClothesSummary(rows);
  assert.equal(summary.orderedTotal, 4);
  assert.equal(summary.physicalTotal, 2);
  assert.equal(summary.missingTotal, 2);
  assert.equal(summary.extraTotal, 0);
  assert.equal(summary.matchedRows, 1);
  assert.deepEqual(summary.serviceBreakdown, [{ serviceName: 'Press / Ironing', count: 2 }]);

  const payload = toVerifyOrderPayload(rows, 1);
  assert.deepEqual(payload, [{ clothType: 'Shirt', serviceId: 1, quantity: 2 }]);
});

test('extractScriptBundleName parses Vite hashed bundle from index.html', () => {
  const html = `<!doctype html><html><head><script type="module" crossorigin src="/admin/assets/index-CdANja-x.js"></script></head></html>`;
  assert.equal(extractScriptBundleName(html), 'index-CdANja-x.js');
});
