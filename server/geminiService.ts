import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

function handleGeminiError(err: any, context: string): never {
  console.error(`Gemini Error [${context}]:`, err);
  let message = err.message || "Unknown AI error";
  if (message.includes("404") || message.includes("not found")) {
    message = `Model Not Found (404). This usually means your API Key's project hasn't enabled the "Generative Language API" or the model is unavailable in your region. Check Google AI Studio.`;
  }
  throw new Error(`${context} failed: ${message}`);
}

const MODEL_NAME = "gemini-flash-latest";

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
- type: 'logos', title: string, logos: string[] // List of brand names or emoji logos
- type: 'stats', title: string, items: { value: string, label: string }[]
- type: 'cta_banner', title: string, subtitle: string, cta: string
`;

export async function generateLandingPageFromContent(params: {
  businessName: string;
  industry?: string;
  goal?: string;
  rawContent?: string;
  description?: string;
  currentSections?: any[];
}) {
  const model = getGenAI().getGenerativeModel({ 
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTION
  });

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

/**
 * Agent Manager: Phase 1 - Planning
 * Generates a high-level Implementation Plan (Markdown).
 */
export async function generatePlan(params: {
  prompt: string;
  businessName?: string;
  description?: string;
}) {
  const model = getGenAI().getGenerativeModel({ 
    model: MODEL_NAME,
    systemInstruction: "You are an Agent Manager. Analyze the user's prompt and create a technical Implementation Plan in Markdown. Focus on layout, tone, selected skills, and unique features. Do NOT return code, just the plan."
  });

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
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err: any) {
    handleGeminiError(err, "Planning");
  }
}

/**
 * Agent Manager: Phase 2 - Execution
 * Generates the final JSON structure using injected Skills.
 */
export async function executeWithSkills(params: {
  plan: string;
  businessName: string;
  industry?: string;
  goal?: string;
  rawContent?: string;
  description?: string;
  currentSections?: any[];
}) {
  // Logic to 'Auto-Select' skills based on the plan/prompt (simplified for now as full injection)
  const activeSkills = Object.values(SKILLS).join("\n");

  const model = getGenAI().getGenerativeModel({ 
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTION + "\n\nAPPLY THESE SKILLS:\n" + activeSkills
  });

  const schema = {
    description: "Landing page holistic structure",
    type: SchemaType.OBJECT,
    properties: {
      metadata: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "Refined business/brand name" },
          slug: { type: SchemaType.STRING, description: "URL-safe slug (e.g. 'chrono-luxury')" },
          title: { type: SchemaType.STRING, description: "Benefit-driven SEO title" },
          description: { type: SchemaType.STRING, description: "Compelling meta description" }
        },
        required: ["name", "slug", "title", "description"]
      },
      sections: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            type: { type: SchemaType.STRING, enum: ["hero", "features", "pricing", "testimonials", "faq", "form", "events", "cta", "content", "gallery", "logos", "stats", "cta_banner"] },
            title: { type: SchemaType.STRING },
            subtitle: { type: SchemaType.STRING },
            cta: { type: SchemaType.STRING },
            items: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { title: { type: SchemaType.STRING }, text: { type: SchemaType.STRING }, icon: { type: SchemaType.STRING }, value: { type: SchemaType.STRING }, label: { type: SchemaType.STRING } } } },
            logos: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            plans: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { name: { type: SchemaType.STRING }, price: { type: SchemaType.STRING }, features: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }, featured: { type: SchemaType.BOOLEAN } } } },
            fields: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { label: { type: SchemaType.STRING }, type: { type: SchemaType.STRING }, placeholder: { type: SchemaType.STRING } } } }
          },
          required: ["type"]
        }
      }
    },
    required: ["metadata", "sections"]
  };

  const prompt = `
    IMPLEMENTATION PLAN:
    ${params.plan}

    CONTEXT:
    Business Name: ${params.businessName}
    Industry: ${params.industry || "General"}
    Primary Goal: ${params.goal || "Brand Awareness"}
    Description: ${params.description || "N/A"}
    Current Sections: ${params.currentSections ? JSON.stringify(params.currentSections) : "None"}

    INSTRUCTIONS:
    1. Define the holistic 'metadata' for this page.
    2. Generate the detailed 'sections' as outlined in the plan.
    3. Use active, modern, and high-fidelity copy.
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: "application/json",
        responseSchema: schema as any
      },
    });
    return JSON.parse(result.response.text());
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
  const model = getGenAI().getGenerativeModel({ 
    model: MODEL_NAME,
    systemInstruction: "You are a Section Specialist. You receive a JSON section and user feedback. Your goal is to apply the feedback and return the UPDATED JSON section only. Maintain the original schema."
  });

  const prompt = `
    CURRENT SECTION:
    ${JSON.stringify(params.section)}

    FEEDBACK:
    ${params.feedback}

    CONTEXT:
    ${JSON.stringify(params.businessContext)}

    Return ONLY the updated JSON for this specific section.
  `;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  try {
    return JSON.parse(result.response.text());
  } catch (err) {
    handleGeminiError(err, "Refinement");
  }
}
