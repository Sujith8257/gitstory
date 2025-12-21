const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

async function generateFavicon() {
  const svgPath = path.join(__dirname, "../public/icon.svg");
  const faviconPath = path.join(__dirname, "../src/app/favicon.ico");
  const publicFaviconPath = path.join(__dirname, "../public/favicon.ico");

  // Read the SVG file
  const svgBuffer = fs.readFileSync(svgPath);

  // Generate 32x32 PNG for favicon
  const pngBuffer = await sharp(svgBuffer).resize(32, 32).png().toBuffer();

  // Generate 16x16, 32x32, and 48x48 sizes for proper ICO
  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(svgBuffer).resize(size, size).png().toBuffer())
  );

  // Create ICO file manually (simple ICO format)
  const icoBuffer = createIco(pngBuffers, sizes);

  // Write favicon.ico to src/app (Next.js App Router convention)
  fs.writeFileSync(faviconPath, icoBuffer);
  console.log(`✅ Created favicon.ico at ${faviconPath}`);

  // Also copy to public folder for broader compatibility
  fs.writeFileSync(publicFaviconPath, icoBuffer);
  console.log(`✅ Created favicon.ico at ${publicFaviconPath}`);

  // Generate additional PNG sizes for PWA and Google Search (48x48 minimum required)
  const pwaSizes = [48, 192, 512];
  for (const size of pwaSizes) {
    const pngPath = path.join(__dirname, `../public/icon-${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(pngPath);
    console.log(`✅ Created icon-${size}.png`);
  }
}

function createIco(pngBuffers, sizes) {
  // ICO file format:
  // ICONDIR (6 bytes) + ICONDIRENTRY array (16 bytes each) + PNG data

  const numImages = pngBuffers.length;
  const headerSize = 6 + 16 * numImages;

  // Calculate total size
  let totalSize = headerSize;
  for (const buf of pngBuffers) {
    totalSize += buf.length;
  }

  const icoBuffer = Buffer.alloc(totalSize);
  let offset = 0;

  // ICONDIR header
  icoBuffer.writeUInt16LE(0, offset);
  offset += 2; // Reserved
  icoBuffer.writeUInt16LE(1, offset);
  offset += 2; // Type (1 = ICO)
  icoBuffer.writeUInt16LE(numImages, offset);
  offset += 2; // Number of images

  // Calculate data offset for each image
  let dataOffset = headerSize;

  // ICONDIRENTRY for each image
  for (let i = 0; i < numImages; i++) {
    const size = sizes[i];
    const pngData = pngBuffers[i];

    icoBuffer.writeUInt8(size === 256 ? 0 : size, offset);
    offset += 1; // Width
    icoBuffer.writeUInt8(size === 256 ? 0 : size, offset);
    offset += 1; // Height
    icoBuffer.writeUInt8(0, offset);
    offset += 1; // Color palette
    icoBuffer.writeUInt8(0, offset);
    offset += 1; // Reserved
    icoBuffer.writeUInt16LE(1, offset);
    offset += 2; // Color planes
    icoBuffer.writeUInt16LE(32, offset);
    offset += 2; // Bits per pixel
    icoBuffer.writeUInt32LE(pngData.length, offset);
    offset += 4; // Size of image data
    icoBuffer.writeUInt32LE(dataOffset, offset);
    offset += 4; // Offset to image data

    dataOffset += pngData.length;
  }

  // Write PNG data
  for (const pngData of pngBuffers) {
    pngData.copy(icoBuffer, offset);
    offset += pngData.length;
  }

  return icoBuffer;
}

generateFavicon().catch(console.error);
