const bwipjs = require('bwip-js');

const generateBarcode = async (barcodeText) => {
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',      // Barcode type
      text: barcodeText,    // Text to encode
      scale: 3,             // 3x scaling factor
      height: 10,           // Bar height, in millimeters
      includetext: true,    // Show human-readable text
      textxalign: 'center', // Center the text
    });
    return png;
  } catch (err) {
    console.error('Error generating barcode:', err);
    throw err;
  }
};

module.exports = { generateBarcode };