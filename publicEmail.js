import { fetchUserInfo } from "./instaUser.js";
import fs from "fs";
import path from "path";

// Instagram usernames to process
const instagramUsernames = [
  "hannahpolites",
  "brookeiseppi",
  "seanszeps",
  "courtneyadamo",
  "melwatts",
  "scottcreates",
  "sarahkearnsofficial",
  "iam.mrluke",
  "betsysunnywynters",
  "_theaftergrogblog",
  "thisisalexei",
  "s4mguggenheimer",
  "sarahs_day"
  ];

const publicEmailFilePath = path.join(process.cwd(), "publicEmail.json");

// Load or create initial publicEmail file
function initPublicEmailData() {
  if (!fs.existsSync(publicEmailFilePath)) {
    fs.writeFileSync(publicEmailFilePath, JSON.stringify({ users: [] }, null, 2));
  }
  try {
    const content = fs.readFileSync(publicEmailFilePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error("❌ Failed to parse publicEmail.json, starting fresh.");
    return { users: [] };
  }
}

// Save user data to publicEmail.json
function saveUserData(userObj) {
  const data = initPublicEmailData();

  const existingIndex = data.users.findIndex(u => u.username === userObj.username);
  if (existingIndex !== -1) {
    data.users[existingIndex] = userObj;
  } else {
    data.users.push(userObj);
  }

  fs.writeFileSync(publicEmailFilePath, JSON.stringify(data, null, 2));
  console.log(`✅ Saved: ${userObj.username}`);
}

// Start processing
(async () => {
  console.log("🚀 Starting Instagram public email extraction...");
  
  for (const username of instagramUsernames) {
    try {
      console.log(`🔍 Fetching info for ${username}`);

      const userData = await fetchUserInfo(username);

      const publicEmail = userData?.data?.public_email || null;
      
      // Create user object - include all users, with null for those without email
      const userObj = {
        username,
        instagram: `https://www.instagram.com/${username}`,
        public_email: publicEmail
      };

      // Save every user, whether they have an email or not
      saveUserData(userObj);
      
      if (publicEmail) {
        console.log(`📧 Found email for ${username}: ${publicEmail}`);
      } else {
        console.log(`ℹ️ No public email for ${username}, saved as null`);
      }

      await new Promise(res => setTimeout(res, 1000)); // wait 1s before next user

    } catch (err) {
      console.error(`❌ Error processing ${username}:`, err);
      
      // Even in case of error, save the user with null email
      const userObj = {
        username,
        instagram: `https://www.instagram.com/${username}`,
        public_email: null
      };
      
      saveUserData(userObj);
      console.log(`⚠️ Error occurred but saved ${username} with null email`);
    }
  }

  console.log("🎉 All usernames processed. Data saved to publicEmail.json");
})();