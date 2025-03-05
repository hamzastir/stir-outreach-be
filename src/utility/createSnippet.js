import dotenv from "dotenv";
import OpenAI from "openai";
import { db } from "../db/primaryDb.js";
dotenv.config();

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});
async function getTopInfluencers() {
  try {
    const influencers = await db("influencer_onboarded")
      .select("handle")
      .where("onboard_completed", true)
      .andWhere("onboarded_at", ">=", db.raw("NOW() - INTERVAL '15 days'"))
      .orderBy("total_audience", "desc") // Sorting by audience size
      .limit(2); // Fetch top 2 influencers

    if (influencers.length === 0) {
      return ""; // Return empty if no influencers are found
    }

    // Extract handles and format the message
    const handles = influencers.map((i) => `@${i.handle}`);
    const firstTwo = handles.join(", ");

    const numbers = [20, 21, 22, 23, 26, 27, 28];
    const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];

    return `${firstTwo} + ${randomNumber} others have recently got their exclusive access to Stir!`;
  } catch (error) {
    console.error("Error fetching top influencers:", error);
    return "";
  }
}


async function generateEmailSnippets(username, email, captions, bio) {
  try {
    const prompt1 = `
     Generate only the 2-3 line personalized message for an email to a film influencer, using the structure and tone of the example below. Focus on specificity and differentiation while sounding warm and human.

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
      messages: [{ role: "user", content: prompt1 }],
    });

    const dbResult = await getTopInfluencers();

    return {
      snippet1: response.choices[0]?.message?.content.trim() || "",
      snippet2: dbResult,
    };
  } catch (error) {
    console.error("Error generating email snippets:", error);
    throw error;
  }
}

export default generateEmailSnippets;
