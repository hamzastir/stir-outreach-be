import axios from "axios";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Your RapidAPI key from environment variables
const RAPIDAPI_KEY = '6daf848de6msheffe53ac27d1889p17e2d8jsn8675487c1c0f';

// Array of Instagram usernames to fetch data for
const usernamesToFetch = [
  "kodakmovies",
  "straw_hat_goofy",
  "thecinemastories",
  "imtropicaljoe",
  "nadsreviews",
  "movie.review_man_man_man",
  "moviefestuk",
  "filmmnostalgia",
  "maddikoch",
  "mikedeestro",
  "payorwait",
  "itstyreek",
  "thaddybears",
  "therealsupes",
  "jacobweeby",
  "moviewatchinggirl",
  "thisisalexei",
  "nicksflicksfix",
  "liamlovesmovies",
  "movieupdate_",
  "lifeofdevint",
  "therealdoomblazer",
  "3cfilm",
  "nonauppal",
  "aparnaupadhyay",
  "filmirly",
  "anybodylikescinema",
  "indiasfilmss",
  "thecinegogue",
  "filmsric",
  "patrickadougall",
  "liv.pearsall",
  "cinema.joe_",
  "moviesaretherapy",
  "thatdocumentarygirl",
  "sethsfilmreviews",
  "itsjustcinema",
  "bryce_jv",
  "lopezzmovies",
  "filmsyoushouldbewatching",
  "itsamoviepage",
  "moviesunofficial",
  "su4ita",
  "goosebumpscinema",
  "filmdreams",
  "filmsycritic",
  "filmoment",
  "thisweeksmovie",
  "i.dream.movies",
  "cinema_perspective",
  "cinemapov",
  "thefilmzone",
  "soulcinema_",
  "cinefilosoficial",
  "excelsiorr___",
  "cinema.shitposting",
  "seantalksabout",
  "alberttalks",
  "thefilmpope",
  "cinemonika",
  "j.stoobs",
  "sactownmoviebuffs",
  "bluray_dan",
  "theflickpick",
  "kermodeandmayo",
  "filmatic",
  "the_goodfilms",
  "fuckinggoodmovies",
  "eatmovies",
  "thefilmthusiasts",
  "cinema.magic",
  "cinephile.club",
  "nightdrivefilms",
  "the.film.culture",
  "colorpalette.cinema",
  "illusiooncinema",
  "cinemaexcelsiorr",
  "filmthusiast",
  "cine.majestic",
  "thebettercinema",
  "filmsguild",
  "filmaesthete",
  "bestofmovies.in",
  "fuckingbestfilms",
  "cinematography.scene",
  "cinemadrive_",
  "cinema_dream",
  "cinephileboi",
  "filmpulse_",
  "alexishorror",
  "artof.cinema",
  "the.movie.journal",
  "bymarinamay",
  "ddreamersdiaries",
  "uncutfilms.it",
  "thecinemagroupnews",
  "themoviesfeeds",
  "cineoholic",
  "chrovies",
  "movienfreaks",
  "cinepolls",
  "thecinesaga",
  "thefilmreality",
  "thefilmessential",
  "leoo.films",
  "aanchalchaturvedii",
  "cocainevinyl",
  "rae_review"
];

// File path for saving data
const filePath = 'titanData.json';

// Initialize the data file if it doesn't exist
function initializeDataFile() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    console.log(`Initialized empty data file at ${filePath}`);
  }
}

// Read current data from file
function readCurrentData() {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading data file: ${error.message}`);
    return [];
  }
}

// Save a single user's data to file
function saveUserData(userData) {
  try {
    const currentData = readCurrentData();
    
    // Check if user already exists in data, update if it does
    const existingIndex = currentData.findIndex(item => item.username === userData.username);
    
    if (existingIndex >= 0) {
      currentData[existingIndex] = userData;
    } else {
      currentData.push(userData);
    }
    
    fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));
    console.log(`Data for ${userData.username} saved successfully`);
    return true;
  } catch (error) {
    console.error(`Error saving data for ${userData.username}: ${error.message}`);
    return false;
  }
}

// Function to fetch data for a single username
async function fetchUserData(username) {
  try {
    // Fetch basic profile data
    const profileResponse = await axios.get('https://mediafy-api.p.rapidapi.com/v1/info', {
      params: {
        username_or_id_or_url: username,
        include_about: 'true'
      },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'mediafy-api.p.rapidapi.com'
      }
    });

    const profileData = profileResponse.data.data;
    
    // Fetch posts data to calculate engagement rate
    const postsResponse = await axios.get('https://mediafy-api.p.rapidapi.com/v1/posts', {
      params: {
        username_or_id_or_url: username,
        include_about: 'true'
      },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'mediafy-api.p.rapidapi.com'
      }
    });

    const posts = postsResponse.data.data.items;
    
    // Calculate engagement rate using the last 10 posts
    const { engagementRate, postMetrics } = calculateEngagementRate(posts, profileData.follower_count);
    
    // Extract only the fields we need
    return {
      username: profileData.username,
      name: profileData.full_name,
      followers: profileData.follower_count,
      posts: profileData.media_count,
      location: profileData.about?.country || '', // Using optional chaining
      biography: profileData.biography,
      public_email: profileData.public_email || '',
      engagement_rate: engagementRate,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching data for ${username}:`, error.message);
    return null;
  }
}

// Function to calculate engagement rate based on the formula:
// Total Interactions for last 10 posts = Sum of likes, comments, shares of last 10 posts
// Engagement rate(%) = Total interactions for last 10 posts / Total followers
function calculateEngagementRate(posts, followerCount) {
  try {
    if (!posts || posts.length === 0 || !followerCount) {
      return { engagementRate: 0, postMetrics: [] };
    }
    
    // Sort posts by date (newest first) to ensure we get the most recent ones
    const sortedPosts = [...posts].sort((a, b) => {
      return new Date(b.taken_at_date) - new Date(a.taken_at_date);
    });
    
    // Get the last 10 posts (most recent)
    const lastTenPosts = sortedPosts.slice(0, 10);
    
    let totalInteractions = 0;
    const postMetrics = [];
    
    lastTenPosts.forEach(post => {
      // Sum likes, comments, and shares for each post
      const likes = post.like_count || 0;
      const comments = post.comment_count || 0;
      const shares = post.share_count || 0;
      
      const postInteractions = likes + comments + shares;
      totalInteractions += postInteractions;
      
      // Store metrics for each post for transparency
      postMetrics.push({
        post_id: post.id,
        date: post.taken_at_date,
        likes: likes,
        comments: comments,
        shares: shares,
        total_interactions: postInteractions
      });
    });
    
    // Apply the formula: (Total interactions / Total followers) * 100
    const engagementRate = (totalInteractions / followerCount) * 100;
    
    // Round to 2 decimal places
    return { 
      engagementRate: parseFloat(engagementRate.toFixed(2)),
      postMetrics: postMetrics
    };
  } catch (error) {
    console.error("Error calculating engagement rate:", error);
    return { engagementRate: 0, postMetrics: [] };
  }
}

// Function to fetch and save data
async function fetchData() {
  try {
    console.log('Starting to fetch profile data...');
    
    // Initialize the data file
    initializeDataFile();
    
    // Add a delay between requests to avoid rate limiting
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const username of usernamesToFetch) {
      console.log(`Fetching data for ${username}...`);
      
      try {
        const userData = await fetchUserData(username);
        
        if (userData) {
          // Save data for this user immediately
          const saveSuccess = saveUserData(userData);
          
          if (saveSuccess) {
            successCount++;
            console.log(`Engagement rate for ${username}: ${userData.engagement_rate}%`);
            console.log(`Progress: ${successCount + errorCount}/${usernamesToFetch.length}`);
          } else {
            errorCount++;
            console.error(`Failed to save data for ${username}`);
          }
        } else {
          errorCount++;
          console.error(`No data returned for ${username}`);
        }
      } catch (userError) {
        errorCount++;
        console.error(`Error processing ${username}: ${userError.message}`);
      }
      
      // Delay between requests (2 seconds)
      await delay(2000);
    }
    
    console.log('Data fetch completed');
    console.log({
      success: true,
      message: 'Data fetched and saved successfully',
      successCount,
      errorCount,
      totalProcessed: successCount + errorCount
    });
  } catch (error) {
    console.error('Error in fetch-profiles endpoint:', error);
    console.log({
      success: false,
      message: 'Failed to fetch and save data',
      error: error.message
    });
  }
}

await fetchData();