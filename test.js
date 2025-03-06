import dotenv from "dotenv";
import fs from "fs";
dotenv.config();
import express from "express";
import { fetchUserInfo, fetchUserPosts } from "./instaUser.js";
import { generateEmailSnippets } from "./generateTestSnippet.js";
import generateEmailSnippetsR1 from "./generateTestSnippetR1.js";
const app = express();
const API_HOST = "instagram-scraper-api2.p.rapidapi.com";
const port = 9999;

// Function to process a single username
// Function to process a single username
async function processUsername(username) {
  try {
    console.log(`Processing username: ${username}`);

    const userPosts = await fetchUserPosts(username);
    const userBio = await fetchUserInfo(username);
    const biography = userBio?.data?.biography;

    const filteredPosts = userPosts?.data?.items
      .filter((post) => !post.is_pinned)
      .map((post) => ({
        caption: post?.caption?.text,
        taken_at_date: post.taken_at_date,
      }))
      .slice(0, 5);

    const captions = filteredPosts.map((post) => post.caption);
    
    // Get snippets from different models
    // const o1Snippet = await generateEmailSnippets(username, captions, biography);
    const r1Result = await generateEmailSnippetsR1(username, captions, biography);

    return {
      username,
      biography,
      caption1: filteredPosts[0]?.caption || "",
      caption2: filteredPosts[1]?.caption || "",
      caption3: filteredPosts[2]?.caption || "",
      caption4: filteredPosts[3]?.caption || "",
      caption5: filteredPosts[4]?.caption || "",
      // "o1-mini": o1Snippet,
      "deepseek-r1": r1Result.snippet,
    };
  } catch (error) {
    console.error(`Error processing ${username}:`, error);
    return null;
  }
}

// Array of usernames to process
const usernames = [
  "filmprobe",
  "cinemafromthepast",
  "thecinemonie",
  "asiancinemaarchive",
  "filmsyoushouldbewatching",
  "rayanistyping",
  "cineoholic",
  "thecinemagroup",
  "unyolo_movies_blog",
  "cineatomy",
  "moviepass",
  "movies.capsule",
  "thecinemagroupnews",
  "luckychap",
  "raindancefilmfestival",
  "aliplumb",
  "officialuniversalmonsters",
  "barbicancentre",
  "moviewatchinggirl",
  "cine.magician",
  "gabriellak_k",
  "frankfilmclub",
  "filmtitan",
];

app.get("/", async (req, res) => {
  try {
    const results = [];

    // Process each username sequentially
    for (const username of usernames) {
      const result = await processUsername(username);
      if (result) {
        results.push(result);

        // Save to file after each successful processing
        fs.writeFileSync("output.json", JSON.stringify(results, null, 2));
        console.log(`Saved results for ${username} to output.json`);
      }

      // Add a delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    res.json({ message: "Processing complete", count: results.length });
  } catch (error) {
    console.error("Main error:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

app.get("/userdata", async(req, res)=>{
  const userData = await fetchUserInfo('frankfilmclub');
  // unyolo_movies_blog, luckychap, moviepass, movies.capsule, officialuniversalmonsters, gabriellak_k, cine.magician, filmtitan
  res.json(userData);
})
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get("/user", async (req, res) => {
  try {
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ error: "Invalid or empty usernames array" });
    }

    const results = {};
    const BATCH_SIZE = 5; // Process 5 usernames at a time
    const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds delay between requests
    const MAX_RETRIES = 3;

    // Process usernames in batches
    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
      const batch = usernames.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (username) => {
        for (let retry = 0; retry < MAX_RETRIES; retry++) {
          try {
            await delay(DELAY_BETWEEN_REQUESTS); // Add delay before each request
            const userDetails = await fetchUserInfo(username);
            
            results[username] = {
              biography_email: userDetails?.data?.biography_email || null,
              public_email: userDetails?.data?.public_email || null
            };
            
            break; // Success - exit retry loop
          } catch (error) {
            if (error.status === 429) { // Rate limit error
              const retryAfter = parseInt(error.headers?.['retry-after']) || 30;
              await delay(retryAfter * 1000); // Wait for the specified time
              continue; // Try again
            }
            
            console.error(`Error fetching details for ${username} (attempt ${retry + 1}):`, error);
            
            if (retry === MAX_RETRIES - 1) { // Last retry
              results[username] = {
                biography_email: null,
                public_email: null,
                error: "Failed to fetch after multiple attempts"
              };
            }
          }
        }
      });

      await Promise.all(batchPromises);
    }

    res.json(results);

  } catch (error) {
    console.error("Error in user details API:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



app.listen(port, () => {
  console.log("Listening on port " + port);
});
