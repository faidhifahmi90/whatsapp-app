import { getSettings } from "../server/db.ts";
import dotenv from "dotenv";

dotenv.config();

async function listAllModels() {
  const settings = getSettings();
  const apiKey = settings.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ No API Key found. Please add it in Atrium Settings.");
    return;
  }

  // We use the REST API directly as the SDK doesn't expose listModels comfortably yet
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    console.log("🔍 Fetching available Gemini models...");
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("API Error:", data.error.message);
      return;
    }

    console.log("\n✅ Available Models:");
    data.models?.forEach((m: any) => {
      console.log(` - ${m.name.replace('models/', '')} [${m.displayName}]`);
    });

  } catch (err) {
    console.error("Network Error:", err);
  }
}

listAllModels();
