import dotenv from "dotenv";
import OpenAI from "openai";
import { db } from "../db/primaryDb.js";
dotenv.config();

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});
function sanitizeText(text) {
  // Remove markdown formatting
  text = text
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1") // italic
    .replace(/__(.*?)__/g, "$1") // alternative bold
    .replace(/_(.*?)_/g, "$1"); // alternative italic

  return text.trim();
}
async function getTopInfluencers() {
  try {
    const influencers = await db.raw(`
      SELECT handle 
      FROM influencer_onboarded
      WHERE onboard_completed = true 
      AND verified_by_admin = true
      AND onboarded_at >= NOW() - INTERVAL '15 days'
      ORDER BY RANDOM()  
      LIMIT 2;
    `);

    if (!influencers?.rows || influencers.rows.length === 0) {
      return "";
    }

    const handles = influencers.rows.map((i) => `@${i.handle}`);
    const firstTwo = handles.join(", ");

    const numbers = [20, 21, 22, 23, 26, 27, 28];
    const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];

    return `${firstTwo} + ${randomNumber} others have recently joined us.`;
  } catch (error) {
    console.error("Error fetching top influencers:", error);
    return `@spaceofcenema, @filmtvrate + 23 others have recently joined us.`;
  }
}

async function generateEmailSnippets(username, email, captions, bio) {
  try {
    if (!username || !captions || !bio) {
      throw new Error("Missing required parameters");
    }

    const prompt1 = `Generate only the 2-3 line [Personalised message] for an email to a film influencer, using the structure and tone of the example below. Focus on specificity and differentiation while sounding warm and human not written by AI.

Reference mail:

Hey @username,

[Personalised message] 

We’re building something exciting at Stir—an invite-only marketplace to connect influencers like you with indie filmmakers and major studios, offering early access to upcoming releases.

What makes us unique? Vetted clients. Built-in AI. Fast payments. A flat 10% take rate.
I’d love to hear your thoughts and see if this is something you’d like to explore (add spintax).

No pressure (add spintax)—feel free to reply to this email or set up a quick call here: calendly.com/stir. Or if you’re ready to dive in, you can also onboard here: https://createstir.com/onboard.

Viva cinema!
Yug Dave
PS: @filmtvrate, @cinephile.sphere and + 23 others have recently joined!

Input:
  - Name, Bio and 5 captions would be provided below

Rules:

Voice & Differentiation: Reference their unique content creation style using their bio/captions. Avoid generic praise.

Tone: Use conversational phrases (e.g., "Your feed feels like…", "I’ve been struck by how…", “It’s great to see…”) and avoid polished/salesy language. Make it sound like it's coming from human, not AI. 

Flow: Refer the mail structure shared above and maintain a good story arc and flow to the personalised message section so that it’s easy to read and connects well with the intended influencer.

Plain text: you should not italicize or bold things. A response should be plain text as formatting stuff is a spam signal
Structure:

Ending note: Do not mention why this influencer might be a good fit for Stir or even for filmmakers. Keep it raw and not salesy.

Depth: Highlight their ability to spark conversation if you find such elements in their captions or highlight how they are elevating underappreciated work if they are spotlighting indie films. Be crafty about it, don’t make it generic.

Length: Personalised message should sum up in max 3-4 sentences. 

Avoid:

Avoid mentions of specific post from their feed unless critical to their niche.

Avoid mentions of external links, bio handles of other people, jargon, or repetitive phrasing.


Example Input for the cinemonie:
"username": "thecinemonie",
    "biography": "Founder: @onur_sumer \n   • Photography | @thephotomonie \nLetterboxd:",
    "caption1": "Meshes of the Afternoon (1943)\n\nDirectors: Maya Deren, Alexander Hammid",
    "caption2": "Rooms of David Lynch\n\n1 • Twin Peaks: Fire Walk with Me (1992)\n2 • Eraserhead (1977)\n3 • Blue Velvet (1986)\n4 • Dune (1984)\n5 • Rabbits (2002)\n6 • Lost Highway (1997)\n7 • Mulholland Drive (2001)\n8 • The Elephant Man (1980)\n9 • Wild at Heart (1990)\n10 • Inland Empire (2006)",
    "caption3": "Harakiri (1962)\n\nDirector: Masaki Kobayashi\nActor: Tatsuya Nakadai",
    "caption4": "Thieves Like Us (1974) & Do the Right Thing (1989)",
    "caption5": "The Devil's Envoys (1942)\n\nDirector: Marcel Carné",



Example Output for thecinemonie: 

Your feed feels like a curated journey through cinematic history, from Deren to Lynch and beyond. I’ve been struck by how you showcase not just well-known films, but also works like The Devil's Envoys—elevating often underappreciated gems. It's great to see your passion for film.

Output Format:
The output should be a plain text response in the following format:
Only return the 2-3 line [Personalised message] in plain text. No Markdown, No greetings, No sign-offs, and No extra text .

Influencer Data:
Input:
  - Name: ${username}
  - Bio: "${bio}"
  - Captions from last 4 posts: "${captions}"`; // Rest of the prompt remains the same
    console.log("deepseek is generating snippet for " + username);

    let retries = 3;
    let aiResponse;

    while (retries > 0) {
      try {
        aiResponse = await openai.chat.completions.create({
          model: "deepseek-reasoner",
          messages: [{ role: "user", content: prompt1 }],
        });

        // If successful, break out of the retry loop
        break;
      } catch (apiError) {
        retries--;
        console.warn(
          `API call failed, ${retries} retries left. Error: ${apiError.message}`
        );

        if (retries === 0) {
          throw apiError; // Re-throw if all retries failed
        }

        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, (3 - retries) * 2000)
        );
      }
    }

    // Second snippet - Top influencers
    const dbResult = await getTopInfluencers();
    const response = {
      snippet1: sanitizeText(aiResponse.choices[0].message.content.trim()),
      snippet2: dbResult,
    };
    console.log({ response });

    return response;
  } catch (error) {
    console.error("Error generating email snippets:", error);
    throw error;
  }
}
// const dbResponse = await generateEmailSnippets(
//   "cinemafromthepast",
//   "email",
//   [
//     "This is the best thing you’ll see all day. Guaranteed. 🎵 😭 \n\nCredit : @sandlerspins \nRe-post: @pubity 🔄",
//     "This is awesome 😄\n@funkstercosplay is a certified legend. 👊 \n\nR/p: @pubity 🔄",
//     "10 pairs of actors you had no idea were the same age 🤜🤛\n.\nWhich one was the most surprising?\nFollow @cinemafromthepast for more!\n.\nCredits: @the_goodfilms",
//     "10 pairs of actors you had no idea were the same age 🤜🤛\n.\nWhich one was the most surprising?\nFollow @cinemafromthepast for more!\n.\nCredits: @the_goodfilms",
//     "Hollywood is in good hands ✨ Here are some talented young actors and actresses to keep an eye on.\n\nWho would you add to this list? 💭\n\n[Via : @goosebumpscinema ]",
//   ],
//   "Your one and only cinema guru. \n📬 cinemafromthepast@gmail.com\nNEW Tik Tok Page Below"
// );
// console.log(dbResponse);
export default generateEmailSnippets;
