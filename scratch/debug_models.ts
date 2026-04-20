import { getSettings } from "../server/db.ts";
import dotenv from "dotenv";

dotenv.config();

async function checkModels() {
  const settings = getSettings();
  const apiKey = settings.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("No GEMINI_API_KEY found in DB or .env");
    return;
  }

  console.log("Checking models for key starting with:", apiKey.substring(0, 4));
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("API Error:", JSON.stringify(data.error, null, 2));
    } else {
      console.log("Available Models:");
      data.models?.forEach((m: any) => {
        console.log(` - ${m.name} (${m.displayName})`);
      });
      
      const hasFlash = data.models?.some((m: any) => m.name.includes("gemini-1.5-flash"));
      console.log("\nGemini 1.5 Flash Support:", hasFlash ? "YES" : "NO");
    }
  } catch (err) {
    console.error("Network Error:", err);
  }
}

checkModels();
