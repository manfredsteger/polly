#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'client', 'src', 'locales');
const LOCALE_FILES = ['en.json', 'de.json'];

class TranslationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  findDuplicateKeysWithFullPath(jsonString) {
    const duplicates = [];
    const keyPathTracker = new Map();
    const pathStack = [];
    
    let inString = false;
    let escapeNext = false;
    let keyBuffer = '';
    let collectingKey = false;
    let currentKey = '';
    let lineNum = 1;
    let expectingColon = false;
    let expectingValue = false;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];

      if (char === '\n') {
        lineNum++;
        continue;
      }

      if (escapeNext) {
        if (collectingKey) keyBuffer += char;
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        if (collectingKey) keyBuffer += char;
        continue;
      }

      if (char === '"') {
        if (!inString) {
          inString = true;
          if (!expectingValue) {
            collectingKey = true;
            keyBuffer = '';
          }
        } else {
          inString = false;
          if (collectingKey) {
            currentKey = keyBuffer;
            collectingKey = false;
            expectingColon = true;
          }
          expectingValue = false;
        }
        continue;
      }

      if (inString) {
        if (collectingKey) keyBuffer += char;
        continue;
      }

      if (char === ':' && expectingColon) {
        expectingColon = false;
        expectingValue = true;
        const fullPath = [...pathStack, currentKey].join('.');
        
        if (keyPathTracker.has(fullPath)) {
          duplicates.push({
            key: fullPath,
            firstLine: keyPathTracker.get(fullPath),
            secondLine: lineNum
          });
        } else {
          keyPathTracker.set(fullPath, lineNum);
        }
        continue;
      }

      if (char === '{') {
        if (currentKey && expectingValue) {
          pathStack.push(currentKey);
          currentKey = '';
          expectingValue = false;
        }
        continue;
      }

      if (char === '}') {
        pathStack.pop();
        continue;
      }

      if (char === ',' || char === '[' || char === ']') {
        expectingValue = false;
        continue;
      }
    }

    return duplicates;
  }

  validateJsonSyntax(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      JSON.parse(content);
      return { valid: true, content };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  flattenKeys(obj, prefix = '') {
    const keys = [];
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys.push(...this.flattenKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  compareKeys(enKeys, deKeys) {
    const enKeySet = new Set(this.flattenKeys(enKeys));
    const deKeySet = new Set(this.flattenKeys(deKeys));

    const missingInDe = [];
    const missingInEn = [];

    for (const key of enKeySet) {
      if (!deKeySet.has(key)) {
        missingInDe.push(key);
      }
    }

    for (const key of deKeySet) {
      if (!enKeySet.has(key)) {
        missingInEn.push(key);
      }
    }

    return { missingInDe, missingInEn };
  }

  validate() {
    console.log('🔍 Validating translation files...\n');

    let hasErrors = false;
    const parsedFiles = {};

    for (const file of LOCALE_FILES) {
      const filePath = path.join(LOCALES_DIR, file);
      console.log(`📄 Checking ${file}...`);

      if (!fs.existsSync(filePath)) {
        this.errors.push(`File not found: ${filePath}`);
        hasErrors = true;
        continue;
      }

      const result = this.validateJsonSyntax(filePath);
      if (!result.valid) {
        this.errors.push(`${file}: Invalid JSON - ${result.error}`);
        hasErrors = true;
        continue;
      }

      console.log(`   ✓ Valid JSON syntax`);
      parsedFiles[file] = JSON.parse(result.content);

      const duplicates = this.findDuplicateKeysWithFullPath(result.content);
      if (duplicates.length > 0) {
        hasErrors = true;
        for (const dup of duplicates) {
          this.errors.push(
            `${file}: Duplicate key "${dup.key}" at lines ${dup.firstLine} and ${dup.secondLine}`
          );
        }
        console.log(`   ✗ Found ${duplicates.length} duplicate key(s)`);
      } else {
        console.log(`   ✓ No duplicate keys`);
      }
    }

    if (parsedFiles['en.json'] && parsedFiles['de.json']) {
      console.log(`\n📊 Comparing translation keys...`);
      const comparison = this.compareKeys(
        parsedFiles['en.json'],
        parsedFiles['de.json']
      );

      if (comparison.missingInDe.length > 0) {
        console.log(`   ⚠ ${comparison.missingInDe.length} key(s) missing in de.json`);
        for (const key of comparison.missingInDe.slice(0, 5)) {
          this.warnings.push(`Missing in de.json: ${key}`);
        }
        if (comparison.missingInDe.length > 5) {
          this.warnings.push(`... and ${comparison.missingInDe.length - 5} more`);
        }
      } else {
        console.log(`   ✓ All English keys have German translations`);
      }

      if (comparison.missingInEn.length > 0) {
        console.log(`   ⚠ ${comparison.missingInEn.length} key(s) missing in en.json`);
        for (const key of comparison.missingInEn.slice(0, 5)) {
          this.warnings.push(`Missing in en.json: ${key}`);
        }
        if (comparison.missingInEn.length > 5) {
          this.warnings.push(`... and ${comparison.missingInEn.length - 5} more`);
        }
      } else {
        console.log(`   ✓ All German keys have English translations`);
      }
    }

    console.log('\n' + '='.repeat(50) + '\n');

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      for (const warning of this.warnings) {
        console.log(`   - ${warning}`);
      }
      console.log('');
    }

    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      for (const error of this.errors) {
        console.log(`   - ${error}`);
      }
      console.log('\n❌ Validation FAILED\n');
      process.exit(1);
    } else {
      console.log('✅ All translation files are valid!\n');
      process.exit(0);
    }
  }
}

const validator = new TranslationValidator();
validator.validate();
