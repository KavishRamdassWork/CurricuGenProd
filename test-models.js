const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function main() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.list();
    console.log('Available models:');
    for await (const model of response) {
      if (model.name.includes('image') || model.name.includes('vision') || model.name.includes('generate')) {
        console.log(model.name);
      }
    }
  } catch (error) {
    console.error('List models error:', error);
  }
}

main();
