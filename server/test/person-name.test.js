import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersonName, validPersonName } from '../src/utils/personName.js';

test('accepts realistic Filipino and international full names', () => {
  for (const name of ['Juan Dela Cruz', 'Maria-Luisa Reyes', "D'Arcy Santos", 'Ma. Cristina Peña']) {
    assert.equal(validPersonName(name), true, name);
  }
});

test('rejects numbers and unsupported symbols in account names', () => {
  for (const name of ['Jordan123', '000Mbappe', 'Juan @ Cruz', 'A', '12345']) {
    assert.equal(validPersonName(name), false, name);
  }
});

test('normalizes extra spaces before saving a name', () => {
  assert.equal(normalizePersonName('  Juan   Dela   Cruz  '), 'Juan Dela Cruz');
});
