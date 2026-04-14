import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateEmailContent(prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a professional marketing email based on this prompt: ${prompt}. Return the response in JSON format with 'subject' and 'body' (HTML allowed) fields.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING }
        },
        required: ["subject", "body"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error('Failed to parse Gemini response', e);
    return {};
  }
}

export async function analyzeEmailSpam(subject: string, body: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this email for spam words and deliverability issues. 
    Subject: ${subject}
    Body: ${body}
    
    Return a JSON object with:
    - 'score': 0-100 (100 being perfectly safe)
    - 'issues': array of strings (specific spam words or formatting issues)
    - 'suggestions': array of strings (how to improve)
    - 'improved_subject': string (a better version)
    - 'improved_body': string (a better version)`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          issues: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          improved_subject: { type: Type.STRING },
          improved_body: { type: Type.STRING }
        },
        required: ["score", "issues", "suggestions", "improved_subject", "improved_body"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error('Failed to parse Gemini response', e);
    return {};
  }
}
