
import { GoogleGenAI, Type } from "@google/genai";
import { MASTER_WINE_LIST } from "../constants.tsx";

/**
 * Service to process image OCR for handwritten inventory sheets
 */
export const processHandwrittenSheet = async (base64Image: string): Promise<any[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Create a list of valid names to help the model with matching
    const validNames = MASTER_WINE_LIST.map(item => item.name).join(", ");

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: `Analyze this image of a handwritten inventory sheet from a wine bar. 
            Extract the wine/liquor names and the quantities.
            
            IMPORTANT: You MUST try to match the handwritten names to this list of valid inventory items: [${validNames}]. 
            If a handwritten name is clearly a match to one in the provided list, you MUST use the EXACT name from that list in your response.
            
            Rules:
            - If it looks like a count for "Cellar", quantity is likely an integer (e.g. 1, 5, 12).
            - If it looks like a "Bar" level, look for decimal values like 0.25, 0.5, 0.75.
            - Do not invent items. Only return items clearly visible.
            - Return only a JSON array of objects with "name" and "qty" fields.`
          }
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              qty: { type: Type.NUMBER }
            },
            required: ["name", "qty"]
          }
        }
      }
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("OCR Processing Error:", error);
    throw error;
  }
};
