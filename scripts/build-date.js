#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generate build date
const buildDate = new Date().toISOString();

// Path to compiled output (never touch src/main.ts so builds stay idempotent)
const mainJsPath = path.join(__dirname, '../dist/main.js');

if (!fs.existsSync(mainJsPath)) {
  console.log('⚠️  dist/main.js not found, skipping build date update');
  process.exit(0);
}

// Read the compiled main.js
let mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

// Replace the date line with the build date
const dateRegex = /date:\s*(?:new Date\(\)\.toISOString\(\)|"[^"]*")/;
const replacement = `date: "${buildDate}"`;

if (dateRegex.test(mainJsContent)) {
  mainJsContent = mainJsContent.replace(dateRegex, replacement);

  // Write back to the file
  fs.writeFileSync(mainJsPath, mainJsContent);

  console.log(`✅ Build date updated: ${buildDate}`);
} else {
  console.log('⚠️  Could not find date line to replace in dist/main.js');
}