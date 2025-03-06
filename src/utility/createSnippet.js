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
    const prompt1 = `Generate only the 2-3 line [Personalised message] for an email to a film influencer, using the structure and tone of the example below. Focus on specificity and differentiation while sounding warm and human.

Reference mail:

Hey @username,

[Personalised message] 

We’re building something exciting at Stir—an invite-only marketplace to connect influencers like you with indie filmmakers and major studios, offering early access to upcoming releases.


What makes us unique? Vetted clients. Built-in AI. Fast payments. A flat 10% take rate.
I’d love to hear your thoughts and see if this is something you’d like to explore (add spintax).

No pressure (add spintax)—feel free to reply to this email or set up a quick call here: calendly.com/stir. Or if you’re ready to dive in, you can also onboard here: https://createstir.com/onboard.


Viva cinema!
Yug
PS: @filmtvrate, @cinephile.sphere and + 23 others have recently joined!

Input:
  - Name: ${username}
  - Bio: "${bio}"
  - Captions from last 4 posts: "${captions}"


Rules:

Voice & Differentiation: Reference their unique style (e.g., "unpacking haunting beauty," "bridging classic/avant-garde") using their bio/captions. Avoid generic praise.

Tone: Use conversational phrases (e.g., "Your feed feels like…", "I’ve been struck by how…", “It’s great to see…”) and avoid polished/salesy language.

Flow: Refer the mail structure shared above and maintain a good arc and flow to the personalised message part so that it’s easy to read and connects well with the intended influencer.

Plain text: The output should be in plain text; no bold or italics, no quotes

Structure:

Hook: Relatable observation about their niche or storytelling approach.

Depth: Highlight their ability to spark conversation or elevate underappreciated work.

Length: Personalised message should sum up in max 3-4 sentences. 
Avoid:

Mentions of specific post from their feed unless critical to their niche.

External links, bio handles of other people (e.g., @photomonie), jargon, or repetitive phrasing.


Example Input for the cinemonie:
"username": "thecinemonie",
    "biography": "Founder: @onur_sumer \n   • Photography | @thephotomonie \nLetterboxd:",
    "caption1": "Meshes of the Afternoon (1943)\n\nDirectors: Maya Deren, Alexander Hammid",
    "caption2": "Rooms of David Lynch\n\n1 • Twin Peaks: Fire Walk with Me (1992)\n2 • Eraserhead (1977)\n3 • Blue Velvet (1986)\n4 • Dune (1984)\n5 • Rabbits (2002)\n6 • Lost Highway (1997)\n7 • Mulholland Drive (2001)\n8 • The Elephant Man (1980)\n9 • Wild at Heart (1990)\n10 • Inland Empire (2006)",
    "caption3": "Harakiri (1962)\n\nDirector: Masaki Kobayashi\nActor: Tatsuya Nakadai",
    "caption4": "Thieves Like Us (1974) & Do the Right Thing (1989)",
    "caption5": "The Devil's Envoys (1942)\n\nDirector: Marcel Carné",



Example Output for thecinemonie: 


"Your feed feels like a love letter to cinema’s hidden layers—the way you spotlight Kobayashi’s quiet rage or Lynch’s hypnotic unease turns every post into a conversation starter. It’s that knack for unearthing raw, unsung artistry that makes me think filmmakers on Stir would jump to collaborate with your vision."

Output Format:
Only return the 2-3 line [Personalised message]. No greetings, sign-offs, or extra text.`;

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
