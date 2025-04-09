import generateEmailSnippets from "./src/utility/createSnippet.js";
import { fetchUserInfo, fetchUserPosts } from "./instaUser.js";
import fs from "fs";
import path from "path";

// Instagram usernames to process
const instagramUsernames = [
  "itstyreek",
  "thaddybears",
  "shondarhimes",
  "yvettenicolebrown",
  "therealsupes",
  "jacobweeby",
  "moviewatchinggirl",
  "thisisalexei",
  "nicksflicksfix",
  "alaisdair",
  "sarussellwords",
  "liamlovesmovies",
  "movieupdate_",
  "thescreenmash",
  "lifeofdevint",
  "therealdoomblazer",
  "adamthemovieguy1",
  "thatcinebuff",
  "movienerd4",
  "3cfilm",
  "nonauppal",
  "aparnaupadhyay",
  "filmirly",
  "anybodylikescinema",
  "cultofathena",
  "indiasfilmss",
  "thecinegogue",
  "filmsric",
  "patrickadougall",
  "liv.pearsall",
  "cinema.joe_",
  "moviesaretherapy",
  "thatdocumentarygirl",
  "sethsfilmreviews",
  "thecinemmemes",
  "itsjustcinema",
  "bryce_jv",
  "lynncinema",
  "lopezzmovies",
  "filmsyoushouldbewatching",
  "itsamoviepage",
  "moviesunofficial",
  "su4ita",
  "hasinah.is.watching",
  "goosebumpscinema",
  "filmdreams",
  "filmsycritic",
  "filmoment",
  "thisweeksmovie",
  "marvinmovie",
  "i.dream.movies",
  "lockedincinema",
  "thefilmanic",
  "cinema_perspective",
  "cinemapov",
  "thefilmzone",
  "soulcinema_",
  "cinefilosoficial",
  "filmenergy",
  "violetcults",
  "excelsiorr___",
  "logolessfiles",
  "cinesmile",
  "cinema.shitposting",
  "davechensky",
  "seantalksabout",
  "augustkellerwrites",
  "alberttalks",
  "thefilmpope",
  "cinematechne",
  "cinemonika",
  "j.stoobs",
  "sactownmoviebuffs",
  "bluray_dan",
  "theflickpick",
  "kermodeandmayo",
  "alexzane",
  "filmatic",
  "the_goodfilms",
  "fuckinggoodmovies",
  "eatmovies",
  "thefilmthusiasts",
  "cinema.magic",
  "cinephile.club",
  "tarantinouniverse",
  "cinemonkeys",
  "nightdrivefilms",
  "the.film.culture",
  "nolan_villeneuve_art_gallery",
  "scenepacks.sfmx",
  "goldenfilmz",
  "colorpalette.cinema",
  "illusiooncinema",
  "motionsicknema",
  "cinemaexcelsiorr",
  "cineographer",
  "cinestials",
  "filmthusiast",
  "the_precious_films",
  "cine.majestic",
  "thebettercinema",
  "filmsguild",
  "filmaesthete",
  "honest.critic.reviews",
  "bestofmovies.in",
  "filmgeekcollective",
  "fuckingbestfilms",
  "cinema.shows",
  "cinematography.scene",
  "cinema.greatness",
  "moviequotes",
  "the_cinephilecut",
  "cine.analyze",
  "cinema_nighttt",
  "cinemadrive_",
  "cinema_dream",
  "scorsesepoint",
  "cinevies",
  "cinephileboi",
  "cinemaessential",
  "_instant_philosophy",
  "movie_scenarist",
  "filmpulse_",
  "euphorilogy",
  "moorsdelle",
  "siffnews",
  "cinema.jetaime",
  "cinema.poetry",
  "alexishorror",
  "h9peless",
  "artof.cinema",
  "the.movie.journal",
  "indiewire",
  "bymarinamay",
  "thecinemarchive",
  "ahoy.cinema",
  "ddreamersdiaries",
  "sentences.from.movies",
  "uncutfilms.it",
  "film.booth",
  "cinewithinframe",
  "thecinemagroupnews",
  "themoviesfeeds",
  "filmftish",
  "filmoptimist",
  "actortalk",
  "cineoholic",
  "chrovies",
  "movienfreaks",
  "cinepolls",
  "thecinesaga",
  "thefilmreality",
  "movies.capsule",
  "thefilmessential",
  "afterthoughts_films",
  "leoo.films",
  "cinema_dunkirk",
  "slavicarts",
  "postsapience",
  "cinestheticph",
  "aanchalchaturvedii",
  "indiasfilmss",
  "cocainevinyl",
  "rae_review"
]
;

const outreachFilePath = path.join(process.cwd(), "outreach.json");

// Load or create initial outreach file
function initOutreachData() {
  if (!fs.existsSync(outreachFilePath)) {
    fs.writeFileSync(outreachFilePath, JSON.stringify({ users: [] }, null, 2));
  }
  try {
    const content = fs.readFileSync(outreachFilePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error("❌ Failed to parse outreach.json, starting fresh.");
    return { users: [] };
  }
}

// Save outreach data after each valid user
function saveUserData(userObj) {
  const data = initOutreachData();

  const existingIndex = data.users.findIndex(u => u.username === userObj.username);
  if (existingIndex !== -1) {
    data.users[existingIndex] = userObj;
  } else {
    data.users.push(userObj);
  }

  fs.writeFileSync(outreachFilePath, JSON.stringify(data, null, 2));
  console.log(`✅ Saved: ${userObj.username}`);
}

// Start processing
(async () => {
  console.log("🚀 Starting Instagram outreach data generation...");
  
  for (const username of instagramUsernames) {
    try {
      console.log(`🔍 Fetching info for ${username}`);

      const [userData] = await Promise.all([
        fetchUserInfo(username),
        // fetchUserPosts(username)
      ]);

      const publicEmail = userData?.data?.public_email || null;
      if (!publicEmail) {
        console.log(`⏭️ Skipping ${username} - No public email.`);
        continue;
      }

      // const biography = userData?.data?.biography || "";
      // const lastFiveCaptions = (postsData?.data?.items || [])
      //   .slice(0, 5)
      //   .map(post => post?.caption?.text)
      //   .filter(Boolean);

      // const captionsText = lastFiveCaptions.join('\n\n');
      // const snippet = await generateEmailSnippets(username, publicEmail, captionsText, biography);

      // if (!snippet) {
      //   console.log(`❌ Failed to generate snippet for ${username}`);
      //   continue;
      // }

      const userObj = {
        username,
        instagram: `https://www.instagram.com/${username}`,
        public_email: publicEmail,
        // snippet1: snippet
      };

      saveUserData(userObj);

      await new Promise(res => setTimeout(res, 1000)); // wait 1s before next user

    } catch (err) {
      console.error(`❌ Error processing ${username}:`, err);
    }
  }

  console.log("🎉 All usernames processed.");
})();
