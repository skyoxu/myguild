/**
 * PRD Chunks Extraction Script
 * Extracts individual PRD chunks from flattened XML and creates organized directory structure
 */

import fs from 'fs';
import path from 'path';

// Configuration
const INPUT_FILE = 'shards/flattened-prd.xml';
const OUTPUT_DIR = 'docs/prd_chunks';
const INDEX_FILE = 'prd_chunks.index';

function extractPRDChunks() {
  console.log('📋 John the PM: Starting PRD chunks extraction...');

  try {
    // Read the XML file
    const xmlContent = fs.readFileSync(INPUT_FILE, 'utf8');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`✅ Created directory: ${OUTPUT_DIR}`);
    }

    // Extract all file sections using regex
    const filePattern =
      /<file path='([^']+)'><!\[CDATA\[([\s\S]*?)\]\]><\/file>/g;
    const files = [];
    let match;

    while ((match = filePattern.exec(xmlContent)) !== null) {
      const filename = match[1];
      const content = match[2].trim();

      // Skip empty files
      if (!content) {
        console.log(`⚠️  Skipping empty file: ${filename}`);
        continue;
      }

      files.push({
        filename,
        content,
        path: path.join(OUTPUT_DIR, filename),
      });
    }

    // Write each file
    console.log(`📝 Extracting ${files.length} PRD chunks...`);

    const indexEntries = [];

    files.forEach((file, index) => {
      // Write the content to individual file
      fs.writeFileSync(file.path, file.content, 'utf8');
      console.log(`✅ Created: ${file.filename}`);

      // Extract PRD-ID and title for index
      const prdIdMatch = file.content.match(/PRD-ID:\s*"([^"]+)"/);
      const titleMatch = file.content.match(/Title:\s*"([^"]+)"/);

      indexEntries.push({
        filename: file.filename,
        prdId: prdIdMatch ? prdIdMatch[1] : `CHUNK_${index + 1}`,
        title: titleMatch ? titleMatch[1] : file.filename,
        path: `docs/prd_chunks/${file.filename}`,
      });
    });

    // Create index file
    const indexContent = createIndexContent(indexEntries);
    fs.writeFileSync(INDEX_FILE, indexContent, 'utf8');
    console.log(`📋 Created index: ${INDEX_FILE}`);

    // Summary report
    console.log('\n🎯 PRD Sharding Summary:');
    console.log(`📁 Source: ${INPUT_FILE}`);
    console.log(`📁 Destination: ${OUTPUT_DIR}/`);
    console.log(`📄 Files created: ${files.length}`);
    console.log(`📋 Index file: ${INDEX_FILE}`);

    console.log('\n📋 Extracted PRD Chunks:');
    indexEntries.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.filename}: "${entry.title}"`);
    });

    console.log('\n✅ Document sharding completed successfully!');
  } catch (error) {
    console.error('❌ Error during PRD extraction:', error.message);
    process.exit(1);
  }
}

function createIndexContent(entries) {
  const timestamp = new Date().toISOString();

  let content = `# PRD Chunks Index
# Generated: ${timestamp}
# Source: shards/flattened-prd.xml
# Total chunks: ${entries.length}

`;

  entries.forEach((entry, index) => {
    content += `${entry.filename}|${entry.prdId}|${entry.title}|${entry.path}\n`;
  });

  return content;
}

// Execute the extraction
extractPRDChunks();
