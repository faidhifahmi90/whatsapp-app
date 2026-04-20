import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { SKILLS, SkillKey } from "./skills.js";
import { getSettings } from "./db.js";

dotenv.config();

function getGenAI() {
  const settings = getSettings();
  const apiKey = settings.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please add it in Settings.");
  }
  return new GoogleGenAI({ apiKey });
}

function handleGeminiError(err: any, context: string): never {
  console.error(`Gemini Error [${context}]:`, err);
  let message = err.message || "Unknown AI error";
  if (message.includes("404") || message.includes("not found")) {
    message = `Model Not Found (404). This usually means your API Key's project hasn't enabled the "Generative Language API" or the model is unavailable in your region. Check Google AI Studio.`;
  }
  throw new Error(`${context} failed: ${message}`);
}

const MODEL_NAME = "gemini-2.5-flash";

/**
 * System instruction to ensure Gemini behaves as a high-end web architect.
 */
const SYSTEM_INSTRUCTION = `You are an elite Landing Page Website Developer. 
Your goal is to parse unstructured content and develop and render it into a high-converting, professional landing page.
Always respond in strictly valid JSON format. The sections built are depend on the prompt.
`;

export async function generateLandingPageFromContent(params: {
  businessName: string;
  industry?: string;
  goal?: string;
  rawContent?: string;
  description?: string;
  currentSections?: any[];
}) {
  const ai = getGenAI();

  const prompt = `
    Business Name: ${params.businessName}
    Industry: ${params.industry || "General"}
    Primary Goal: ${params.goal || "Brand Awareness"}
    Description: ${params.description || "N/A"}
    Current Sections Structure: ${params.currentSections ? JSON.stringify(params.currentSections) : "None (Fresh Build)"}
    Raw Content / Prompt: ${params.rawContent || "Generate best practice content based on industry if raw content is sparse."}

    Generate a complete sections array for this website. 
    If Current Sections Structure is provided, use the 'Raw Content / Prompt' to modify, add, or replace sections in that structure while maintaining overall consistency.
    Make the copy persuasive, modern, and aligned with the "tomorrowX" premium aesthetic (bold, minimalist, futuristic).
    Return only the JSON array of sections.
  `;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(result.text ?? "[]");
  } catch (err: any) {
    handleGeminiError(err, "Landing Page Generation");
  }
}

/**
 * Agent Manager: Phase 1 - Planning
 * Generates a high-level Implementation Plan (Markdown).
 */
export async function generatePlan(params: {
  prompt: string;
  businessName?: string;
  description?: string;
}) {
  const ai = getGenAI();

  const prompt = `
    Business: ${params.businessName || "Unknown"}
    Prompt: ${params.prompt}
    Description: ${params.description || "N/A"}
    
    1. Identify the core goal.
    2. List the sections needed.
    3. Determine which skills are required (Premium Aesthetic, Dark Mode, Conversion Engine, etc.).
    4. Outline the technical approach for each section.
  `;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: "You are an Agent Manager. Analyze the user's prompt and create a technical Implementation Plan in Markdown. Focus on layout, tone, selected skills, and unique features. Do NOT return code, just the plan.",
      },
    });
    return result.text;
  } catch (err: any) {
    handleGeminiError(err, "Planning");
  }
}

/**
 * Agent Manager: Phase 2 - Execution
 * Generates the final JSON structure using injected Skills.
 */
export async function executeWithSkills(params: {
  prompt: string;
  businessName: string;
  industry?: string;
  goal?: string;
  rawContent?: string;
  description?: string;
  currentSections?: any[];
}) {
  const ai = getGenAI();
  const activeSkills = Object.values(SKILLS).join("\n");

  const schema = {
    description: "Landing page holistic structure",
    type: Type.OBJECT,
    properties: {
      metadata: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Refined business/brand name" },
          slug: { type: Type.STRING, description: "URL-safe slug (e.g. 'chrono-luxury')" },
          title: { type: Type.STRING, description: "Benefit-driven SEO title" },
          description: { type: Type.STRING, description: "Compelling meta description" }
        },
        required: ["name", "slug", "title", "description"]
      },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["hero", "features", "pricing", "testimonials", "faq", "form", "events", "cta", "content", "gallery", "logos", "stats", "cta_banner"] },
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            cta: { type: Type.STRING },
            items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, text: { type: Type.STRING }, icon: { type: Type.STRING }, value: { type: Type.STRING }, label: { type: Type.STRING } } } },
            logos: { type: Type.ARRAY, items: { type: Type.STRING } },
            plans: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, price: { type: Type.STRING }, features: { type: Type.ARRAY, items: { type: Type.STRING } }, featured: { type: Type.BOOLEAN } } } },
            fields: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, type: { type: Type.STRING }, placeholder: { type: Type.STRING } } } }
          },
          required: ["type"]
        }
      }
    },
    required: ["metadata", "sections"]
  };

  const aiPrompt = `
    USER PROMPT / VISION:
    ${params.prompt}

    CONTEXT:
    Business Name: ${params.businessName}
    Industry: ${params.industry || "General"}
    Primary Goal: ${params.goal || "Brand Awareness"}
    Description: ${params.description || "N/A"}
    Current Sections: ${params.currentSections ? JSON.stringify(params.currentSections) : "None"}

    INSTRUCTIONS:
    1. First, architect a mental model of the landing page based on the User Prompt.
    2. Define the holistic 'metadata' for this page.
    3. Generate the detailed 'sections' that best fulfill the user's vision.
    4. Use active, modern, and high-fidelity copy.
    5. Ensure the structure is optimized for high conversion.
  `;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: aiPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\n\nAPPLY THESE SKILLS:\n" + activeSkills,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return JSON.parse(result.text ?? "{}");
  } catch (err: any) {
    handleGeminiError(err, "Execution");
  }
}

/**
 * Visual Feedback: Section Refinement
 * Updates a single section based on specific feedback.
 */
export async function refineSection(params: {
  section: any;
  feedback: string;
  businessContext: any;
}) {
  const ai = getGenAI();

  const prompt = `
    CURRENT SECTION:
    ${JSON.stringify(params.section)}

    FEEDBACK:
    ${params.feedback}

    CONTEXT:
    ${JSON.stringify(params.businessContext)}

    Return ONLY the updated JSON for this specific section.
  `;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: "You are a Section Specialist. You receive a JSON section and user feedback. Your goal is to apply the feedback and return the UPDATED JSON section only. Maintain the original schema.",
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(result.text ?? "{}");
  } catch (err: any) {
    handleGeminiError(err, "Refinement");
  }
}
