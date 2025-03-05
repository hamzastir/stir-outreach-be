import dotenv from "dotenv";
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export async function generateEmailSnippetsR1(username, captions, bio) {
  try {
    const prompt = 
`Generate only the 2-3 line personalized message for an email to a film influencer, using the structure and tone of the example below. Focus on specificity and differentiation while sounding warm and human.

Input:
  - Name: ${username}
  - Bio: "${bio}"
  - Captions from last 4 posts: "${captions}"


Rules:

Voice & Differentiation: Reference their unique style (e.g., "unpacking haunting beauty," "bridging classic/avant-garde") using their bio/captions. Avoid generic praise.

Tone: Use conversational phrases (e.g., "Your feed feels like…", "I’ve been struck by how…") and avoid polished/salesy language.

Structure:

Hook: Relatable observation about their niche or storytelling approach.

Depth: Highlight their ability to spark conversation or elevate underappreciated work.

Fit: Subtly link their strengths to filmmakers on Stir (e.g., "indie creators would thrive with your…").

Avoid:

Mentions of specific films/directors unless critical to their niche.

External links, bio handles (e.g., @photomonie), jargon, or repetitive phrasing.

Example Reference (Email for thecinemonie):
"Your feed feels like a love letter to cinema’s hidden layers—the way you spotlight Kobayashi’s quiet rage or Lynch’s hypnotic unease turns every post into a conversation starter. It’s that knack for unearthing raw, unsung artistry that makes me think indie filmmakers on Stir would jump to collaborate with your vision."

Output Format:
Only return the 2-3 line personalized message. No greetings, sign-offs, or extra text.
        `;

    const response = await openai.chat.completions.create({
      model: "deepseek-reasoner",
      messages: [{ role: "user", content: prompt }],
    });

    // Get both reasoning and final content
    const content = response.choices[0]?.message?.content;

    // You can choose to return both or just the content
    return {
      snippet: content?.trim() || "",
    };
  } catch (error) {
    console.error("Error generating email snippets:", error);
    throw error;
  }
}

export default generateEmailSnippetsR1;
