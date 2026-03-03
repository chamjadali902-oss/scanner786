/**
 * Shared AI fallback helper.
 * Tries Lovable AI first, falls back to Mistral on 429/402.
 */

const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

interface AIRequestOptions {
  model?: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  retries?: number;
}

export async function callAIWithFallback(options: AIRequestOptions): Promise<Response> {
  const { model = 'google/gemini-2.5-flash', messages, stream = false, retries = 2 } = options;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

  // Try Lovable AI first with retries for 429
  if (LOVABLE_API_KEY) {
    let delay = 2000;
    for (let attempt = 0; attempt < retries; attempt++) {
      const response = await fetch(LOVABLE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, stream }),
      });

      if (response.ok) return response;

      // On 429/402, break out to try Mistral fallback
      if (response.status === 429 || response.status === 402) {
        console.log(`Lovable AI returned ${response.status}, attempting Mistral fallback...`);
        break;
      }

      // Other errors: retry
      if (attempt < retries - 1) {
        console.log(`Lovable AI error ${response.status}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }

      // Last attempt failed with non-429/402 error
      if (MISTRAL_API_KEY) {
        console.log(`Lovable AI failed after retries, trying Mistral fallback...`);
        break;
      }
      return response;
    }
  }

  // Fallback to Mistral
  if (!MISTRAL_API_KEY) {
    throw new Error("Both AI services unavailable. No MISTRAL_API_KEY configured.");
  }

  console.log("Using Mistral AI fallback...");
  const mistralResponse = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages,
      stream,
    }),
  });

  if (!mistralResponse.ok) {
    const text = await mistralResponse.text();
    console.error("Mistral AI error:", mistralResponse.status, text);
    throw new Error(`Mistral AI error: ${mistralResponse.status}`);
  }

  return mistralResponse;
}
