import generateEmailSnippets from "./generateNewSnippet.js";
import { fetchUserInfo, fetchUserPosts } from "./instaUser.js";
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const instagramUsernames = [
  "cosmic.soul.music",
    "elleisalwayshere",
    "juanitosayoficial",
    "sergiosdadjokes",
    "ldope",
    "wazaiii",
    "marvellous__clips",
    "cinemoviiee",
    "henrikwahlstroem",
    "therealmrhorror",
    "wolfythewitch",
    "davidvaughn",
    "marvel.memepage",
    "presepadageek",
    "kirill.englisher",
    "njmom",
    "movies.verse",
    "chwinery",
    "kate.ovens",
    "hosanna.wong",
    "shannonrwatts",
    "glographics",
    "gothic_details",
    "sydneynicoleaddams"
  ];

// Path to outreach JSON file
const outreachFilePath = path.join(process.cwd(), "outreach.json");

// Function to generate email body
// function generateEmailBody(recipient) {
//   if (!recipient.r1snippet) return null;
  
//   const template = `Hi @${recipient.username}, I'm Yug Dave

// ${recipient.r1snippet}

// We're building something exciting at Stir—an invite-only marketplace to connect influencers like you with indie filmmakers and major studios, offering early access to upcoming releases.

// What makes us unique? Vetted clients. Built-in AI. Fast payments. A flat 10% take rate.

// I'd love to hear your thoughts and see if this is something you'd like to explore!

// No pressure—feel free to reply to this email or set up a quick call here: createstir.com/calendly. Or if you're ready to dive in, you can also onboard here: createstir.com/onboard.

// Best,
// Yug Dave
// VP of Stellar Beginnings!

// PS: @spaceofcenema and @filmtvrate others have recently got their exclusive access to Stir!`;

//   return template;
// }

// Initialize or repair outreach.json file
function initOutreachFile() {
  try {
    if (!fs.existsSync(outreachFilePath)) {
      // Create new file if it doesn't exist
      fs.writeFileSync(outreachFilePath, JSON.stringify({ users: [] }, null, 2));
      console.log('✅ Created new outreach.json file');
    } else {
      // Try to read the file to check if it's valid
      try {
        const content = fs.readFileSync(outreachFilePath, 'utf8');
        JSON.parse(content); // Just to validate
        console.log('✅ Existing outreach.json file is valid');
      } catch (parseError) {
        // File exists but is corrupted, create a new one
        console.log('⚠️ Existing outreach.json file is corrupted, creating a new one');
        fs.writeFileSync(outreachFilePath, JSON.stringify({ users: [] }, null, 2));
      }
    }
  } catch (error) {
    console.error('❌ Error initializing outreach.json:', error);
    // As a fallback, try to write a new file
    fs.writeFileSync(outreachFilePath, JSON.stringify({ users: [] }, null, 2));
  }
}

// Update outreach.json with new user data safely
function updateOutreachFile(userData) {
  try {
    let outreachData = { users: [] };
    
    // Try to read current data
    try {
      if (fs.existsSync(outreachFilePath)) {
        const fileContent = fs.readFileSync(outreachFilePath, 'utf8');
        outreachData = JSON.parse(fileContent);
      }
    } catch (readError) {
      console.error(`⚠️ Error reading outreach.json, starting with empty data:`, readError);
      outreachData = { users: [] };
    }
    
    // Check if user already exists
    const userIndex = outreachData.users.findIndex(user => user.username === userData.username);
    
    if (userIndex !== -1) {
      // Update existing user
      outreachData.users[userIndex] = userData;
    } else {
      // Add new user
      outreachData.users.push(userData);
    }
    
    // Write updated data back to file - use temporary file to avoid corruption
    const tempFilePath = `${outreachFilePath}.tmp`;
    fs.writeFileSync(tempFilePath, JSON.stringify(outreachData, null, 2));
    fs.renameSync(tempFilePath, outreachFilePath);
    
    console.log(`✅ Updated outreach.json with data for ${userData.username}`);
  } catch (error) {
    console.error(`❌ Error updating outreach.json for ${userData.username}:`, error);
  }
}

app.get("/api/instagram-data", async (req, res) => {
  try {
    console.log('🚀 Starting Instagram data collection process');
    initOutreachFile();
    
    const allUsersData = [];
    const usersForSnippetGeneration = [];

    // First pass: Collect all user data
    for (const username of instagramUsernames) {
      try {
        console.log(`📊 Fetching data for ${username}...`);

        // Fetch user info and posts in parallel
        const [userData, postsData] = await Promise.all([
          fetchUserInfo(username),
          fetchUserPosts(username),
        ]);

        // Extract captions
        const captions = [];
        if (postsData?.data?.items && postsData.data.items.length > 0) {
          const posts = postsData.data.items.slice(0, 5);
          for (const post of posts) {
            if (post?.caption?.text) {
              captions.push(post.caption.text);
            }
          }
        }

        // Create user object with complete data required for snippet generation
        const userInfo = {
          username: username,
          biography: userData?.data?.biography || "",
          public_email: userData?.data?.public_email || null,
          last_five_captions: captions,
        };
        
        // Add to results and collection for snippet generation
        allUsersData.push(userInfo);
        usersForSnippetGeneration.push(userInfo);
        
        // Store initial user data without snippets yet
        updateOutreachFile(userInfo);
        
        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (userError) {
        console.error(`❌ Error fetching data for ${username}:`, userError);
        const errorUserInfo = {
          username: username,
          error: "Failed to fetch data for this user",
        };
        allUsersData.push(errorUserInfo);
        updateOutreachFile(errorUserInfo);
      }
    }
    
    // Second pass: Generate snippets for all users in a batch
    // if (usersForSnippetGeneration.length > 0) {
    //   try {
    //     console.log(`🎯 Generating snippets for ${usersForSnippetGeneration.length} users`);
        
    //     // Generate snippets one by one to avoid issues with the generateEmailSnippets function
    //     for (const user of usersForSnippetGeneration) {
    //       try {
    //         const userIndex = allUsersData.findIndex(u => u.username === user.username);
    //         if (userIndex === -1) continue;
            
    //         console.log(`Generating snippet for ${user.username}...`);
    //         // Format captions as a string for the API
    //         const captionsText = user.last_five_captions.join('\n\n');
            
    //         // Call the function with individual parameters
    //         const snippet = await generateEmailSnippets(
    //           user.username, 
    //           captionsText, 
    //           user.biography
    //         );
            
    //         if (snippet) {
    //           allUsersData[userIndex].r1snippet = snippet;
    //           allUsersData[userIndex].emailBody = generateEmailBody(allUsersData[userIndex]);
    //           console.log(`📧 Generated snippet and email for ${user.username}`);
              
    //           // Update outreach file with the new data
    //           updateOutreachFile(allUsersData[userIndex]);
    //         }
    //       } catch (error) {
    //         console.error(`❌ Error generating snippet for ${user.username}:`, error);
    //       }
          
    //       // Add a small delay between requests
    //       await new Promise(resolve => setTimeout(resolve, 500));
    //     }
    //   } catch (batchError) {
    //     console.error("❌ Error in snippet generation batch process:", batchError);
    //   }
    // }
    
    console.log('✅ Process completed successfully');
    res.json({ 
      total_users: allUsersData.length,
      users: allUsersData 
    });
  } catch (error) {
    console.error("❌ Error in main process:", error);
    res.status(500).json({ error: "Failed to fetch Instagram users data" });
  }
});

app.get("/api/outreach-data", (req, res) => {
  try {
    if (fs.existsSync(outreachFilePath)) {
      try {
        const fileContent = fs.readFileSync(outreachFilePath, 'utf8');
        const outreachData = JSON.parse(fileContent);
        res.json(outreachData);
      } catch (parseError) {
        console.error("❌ Error parsing outreach.json:", parseError);
        res.status(500).json({ error: "Failed to parse outreach data" });
      }
    } else {
      res.status(404).json({ error: "Outreach data not found" });
    }
  } catch (error) {
    console.error("❌ Error reading outreach data:", error);
    res.status(500).json({ error: "Failed to read outreach data" });
  }
});

app.listen(9999, () => {
  console.log("🌟 Server is running on port 9999");
  console.log("📊 Access Instagram data at: http://localhost:9999/api/instagram-data");
  console.log("📧 Access Outreach data at: http://localhost:9999/api/outreach-data");
});