import express from "express";
import { db } from "../db/db.js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { fetchUserInfo, fetchUserPosts } from "../utility/instaApi.js"

dotenv.config();
const router = express.Router();

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
  
   
  
  const response = sanitizeText(aiResponse.choices[0].message.content.trim())
 console.log({response})
  return response;
    } catch (error) {
      console.error("Error generating email snippets:", error);
      throw error;
    }
  }


async function fetchInstagramUserData(username) {
    console.log(`Fetching Instagram data for ${username}...`);
    try {
      // Fetch user info and posts in parallel
      const [userInfoResponse, userPostsResponse] = await Promise.all([
        fetchUserInfo(username),
        fetchUserPosts(username),
      ]);
  
      // Extract captions from posts
      const captions = [];
      if (userPostsResponse?.data?.items && userPostsResponse.data.items.length > 0) {
        const posts = userPostsResponse.data.items.slice(0, 5);
        for (const post of posts) {
          if (post?.caption?.text) {
            captions.push(post.caption.text);
          }
        }
      }
  
      // Create and return user data object
      return {
        username: username,
        biography: userInfoResponse?.data?.biography || "",
        dm_id : userInfoResponse?.data?.interop_messaging_user_fbid || "",
        public_email: userInfoResponse?.data?.public_email || null,
        last_five_captions: captions,
      };
    } catch (error) {
      console.error(`Error fetching Instagram data for ${username}:`, error);
      // Return minimal data in case of error
      return {
        username: username,
        biography: "",
        public_email: null,
        last_five_captions: [],
      };
    }
  }
  router.get("/user-followups-completed", async (req, res) => {
    try {
      const result = await db("stir_outreach_dashboard")
        .select("user_id", "business_email", "username", "is_instagram_connect", "follow_up_3_date", "instagram_connect_date", "instagram_connect_snippet", "instagram_connect_dm_id")
        .whereNotNull("follow_up_3_date")
        .whereNotNull("follow_up_3_time")
        .andWhere("follow_up_3_status", true)
        // .andWhereNot("is_instagram_connect", 'irrelevant');
  
      res.json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


  router.post("/generate-snippet-from-insta", async (req, res) => {
    const { username, usernames } = req.body;
    
    // Handle both single username and bulk usernames
    if (!username && (!usernames || !usernames.length)) {
      return res.status(400).json({ error: "Username(s) required" });
    }
    
    try {
      // For bulk processing
      if (usernames && usernames.length) {
        const results = [];
        const errors = [];
        
        // Process each username sequentially
        for (const name of usernames) {
          try {
            const { biography, last_five_captions, public_email, dm_id } = await fetchInstagramUserData(name);
            
            if (!biography && last_five_captions.length === 0) {
              errors.push({ username: name, error: "Unable to fetch data" });
              continue;
            }
            
            const captionsCombined = last_five_captions.slice(0, 5).join('\n\n');
            const snippet = await generateEmailSnippets(name, public_email, captionsCombined, biography);
            
            // Save the snippet in the DB
            await db("stir_outreach_dashboard")
              .where({ username: name })
              .update({ 
                instagram_connect_snippet: snippet, 
                instagram_connect_dm_id: dm_id
              });
            
            results.push({ username: name, snippet, dm_id, success: true });
          } catch (error) {
            console.error(`Error processing ${name}:`, error);
            errors.push({ username: name, error: error.message });
          }
        }
        
        return res.json({ results, errors });
      }
      
      // For single username processing
      const { biography, last_five_captions, public_email, dm_id } = await fetchInstagramUserData(username);
      
      if (!biography && last_five_captions.length === 0) {
        return res.status(404).json({ error: "Unable to fetch data for the given username" });
      }
      
      const captionsCombined = last_five_captions.slice(0, 5).join('\n\n');
      const snippet = await generateEmailSnippets(username, public_email, captionsCombined, biography);
      
      // Save the snippet in the DB
      await db("stir_outreach_dashboard")
        .where({ username })
        .update({ 
          instagram_connect_snippet: snippet, 
          instagram_connect_dm_id: dm_id
        });
      
      return res.json({ snippet, dm_id });
    } catch (error) {
      console.error("Error generating snippet:", error);
      return res.status(500).json({ error: "Failed to generate snippet" });
    }
  });
  
  
  router.put("/update-instagram-connects-users", async (req, res) => {
    const { userId, status } = req.body;
  
    try {
      const result = await db("stir_outreach_dashboard")
        .where({ user_id: userId })
        .update({
          is_instagram_connect: status,
          instagram_connect_date: new Date()
        });
  
      if (result) {
        res.status(200).json({ message: "User updated successfully" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
export default router;








// connected filters are not working please make sure to work this
// make sure to have the data as per the 3rd follow-up date the older dated comes as first always have this and and the connected data at the last and generated snippet and not connected at first 
// and still the data is generating on refresh or tab change but  the progress bar is not working while after refresh or page change make sure the this should be seamless and robust and perfect and instead of filter of date based on the 3rd follow up it should be the date range
// please make this bulk generate feature robust as it is not feeling good
// also the instagram_connect_dm after the refresh or any thing the dm link is alsp not working 