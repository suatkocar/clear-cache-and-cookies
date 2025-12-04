const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');
const sizes = [16, 32, 48, 128];

async function convertSvgToPng() {
  for (const size of sizes) {
    const svgPath = path.join(iconsDir, `icon${size}.svg`);
    const pngPath = path.join(iconsDir, `icon${size}.png`);
    
    if (fs.existsSync(svgPath)) {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      console.log(`✓ Created icon${size}.png`);
    }
  }
  console.log('✓ All icons converted to PNG!');
}

convertSvgToPng().catch(console.error);
