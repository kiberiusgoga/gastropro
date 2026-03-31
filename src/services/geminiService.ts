import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getTripAdvice = async (origin: string, destination: string, preferences: string) => {
  const model = "gemini-3-flash-preview";
  const prompt = `You are a "RoadTrip Architect" – a highly intelligent agent specialized in planning car trips.
The user is planning a trip from ${origin} to ${destination}.
Their preferences are: ${preferences}.

Provide a concise summary of the trip, including:
1. Estimated driving time and distance.
2. Top 3 recommended stops along the route (restaurants or points of interest).
3. A "co-pilot" tip for this specific route.

Keep the tone professional, logical, and efficient.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I couldn't generate trip advice at this moment.";
  }
};
