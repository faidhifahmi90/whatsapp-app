import { generatePlan } from "../server/geminiService.ts";

async function verify() {
  console.log("Testing Gemini 2.0 Flash connection...");
  try {
    const plan = await generatePlan({
      prompt: "Create a simple landing page for a coffee shop.",
      businessName: "Bean Haven"
    });
    console.log("SUCCESS! Implementation Plan generated:");
    console.log(plan?.substring(0, 200) + "...");
  } catch (err) {
    console.error("Verification FAILED:", err);
  }
}

verify();
