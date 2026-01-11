
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash-image';

export async function generateOrEditImage(
  prompt: string,
  base64Image?: string,
  mimeType?: string
): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prepare parts
  const parts: any[] = [{ text: prompt }];
  
  if (base64Image && mimeType) {
    parts.unshift({
      inlineData: {
        data: base64Image.split(',')[1] || base64Image,
        mimeType: mimeType,
      },
    });
  }

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts },
  });

  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("No candidates returned from AI");
  }

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data found in AI response");
}
