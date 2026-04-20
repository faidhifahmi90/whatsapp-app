import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * System instruction to ensure Gemini behaves as a high-end web architect.
 */
const SYSTEM_INSTRUCTION = `You are an elite Landing Page Architect. 
Your goal is to parse unstructured business content and transform it into a high-converting, professional landing page structure.
Always respond in strictly valid JSON format.
Each section must have a 'type' from the following list: 'hero', 'features', 'pricing', 'testimonials', 'faq', 'form'.

JSON Schema for sections:
- type: 'hero', title: string, subtitle: string, cta: string
- type: 'features', title: string, items: { icon: string, title: string, text: string }[]
- type: 'pricing', title: string, plans: { name: string, price: string, features: string[], featured?: boolean }[]
- type: 'testimonials', title: string, items: { name: string, role: string, quote: string }[]
- type: 'faq', title: string, items: { q: string, a: string }[]
- type: 'form', title: string, subtitle: string, fields: { label: string, name: string, type: 'text'|'email'|'tel'|'textarea', placeholder: string }[]
`;

export async function generateLandingPageFromContent(params: {
  businessName: string;
  industry: string;
  goal: string;
  rawContent?: string;
  description?: string;
}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in .env");
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION
  });

  const prompt = `
    Business Name: ${params.businessName}
    Industry: ${params.industry}
    Primary Goal: ${params.goal}
    Description: ${params.description || "N/A"}
    Raw Content to parse: ${params.rawContent || "Generate best practice content based on industry if raw content is sparse."}

    Generate a complete sections array for this website. 
    Make the copy persuasive, modern, and aligned with the "tomorrowX" premium aesthetic (bold, minimalist, futuristic).
    Return only the JSON array of sections.
  `;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  try {
    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse Gemini response:", err);
    throw new Error("AI returned invalid structure");
  }
}
