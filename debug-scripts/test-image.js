const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    console.log('Testing imagen-4.0-generate-001 with generateImages...');
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: 'A cute little robot learning math in a classroom, minimal vector art',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9'
      }
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const img = response.generatedImages[0];
      console.log('Success generateImages! Base64 length:', img.image.imageBytes.length);
      return;
    }
  } catch (error) {
    console.error('generateImages error with imagen-4.0:', error.message || error);
  }
  
  try {
    console.log('\nTesting gemini-2.5-flash-image with generateContent...');
    const response2 = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: 'A cute little robot learning math' }]}]
    });
    console.log('generateContent Success!');
    console.log(response2.text?.substring(0, 200) || response2);
  } catch (e2) {
    console.error('generateContent error with flash-image:', e2.message || e2);
  }
}

main();
