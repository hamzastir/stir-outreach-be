// // import { db } from "./src/db/db.js";
// // import generateEmailSnippets from "./src/utility/createSnippet.js";

// import { db } from "./src/db/primaryDb.js";

// // async function getUserPostsAndBio(userId) {
// //   try {
// //     return await db("insta_users as u")
// //       .select([
// //         "u.user_id",
// //         "u.username",
// //         "u.biography",
// //         "p.caption",
// //         "p.taken_at",
// //       ])
// //       .leftJoin("insta_posts as p", "u.user_id", "p.user_id")
// //       .where("u.user_id", 111)
// //       .orderBy("p.taken_at", "desc")
// //       .limit(4);
// //   } catch (error) {
// //     console.error("Error fetching user posts and bio:", error);
// //     throw error;
//  // }
// // }

// // const userPosts = await getUserPostsAndBio();
// // console.log({userPosts})
// // const captions = userPosts.map((post) => post.caption).filter(Boolean);
// // const bio = userPosts[0]?.biography || "";
// // const { snippet1 } = await generateEmailSnippets(
// //   userPosts[0].username,
// //   captions,
// //   bio
// // );
// // console.log(userPosts[0].username,
// //   captions,
// //   bio)
// // const { snippet1 } = await generateEmailSnippets(
// //   "axat02",
// //   ["beautiful morning"],
// //   "I think therefore i am "
// // );
// // console.log({ userPosts });
// // console.log({ snippet1 });




// async function getTopInfluencers() {
//   try {
//     const influencers = await db('influencer_onboarded')
//       .select('handle')
//       .where('onboard_completed', true)
//       .andWhere('onboarded_at', '>=', db.raw("NOW() - INTERVAL '15 days'"))
//       .orderBy('total_audience', 'desc') // Sorting by audience size
//       .limit(2); // Fetch top 25 influencers

//     if (influencers.length === 0) {
//       return ""; // Return empty if no influencers are found
//     }

//     // Extract handles and format the message
//     const handles = influencers.map(i => `@${i.handle}`);
//     const firstTwo = handles.slice(0, 2).join(", ");
    

//     return `${firstTwo} + 23 others have recently got their exclusive access to Stir!`
     

//   } catch (error) {
//     console.error('Error fetching top influencers:', error);
//     return "";
//   }
// }

// const snippe2 = await getTopInfluencers();
// console.log(snippe2)

import generateEmailSnippets from './src/utility/createSnippetR1.js'; // Adjust the import path accordingly

async function testGenerateEmailSnippets() {
  try {
    // Mock data for testing
    const username = "Cindy Tang";
    const email = "cindy.tang@example.com";
    const bio = "a celebration of cinematic history\nbringing comfort through film, tv & music";
    const captions = `
      Are they lovers? Worse. II happy love week! to celebrate, I’m listing some of the most uniquely loved ships by fandoms that hurt too good. I had full faith that these ships SHOULD have been together… many of these are requested by you, and I can’t wait to hear more of your ships. ❤‍🩹Q: Which couple is your “Are they lovers? Worse.”
      Music of Winter Films & TV ❄🎼✨these are some of my favourite music that REMINDS me of winter, the feeling of winter, the chill of winter. it’s crisp, magical, and with hints of snowfall i can’t quite explain. just close your eyes, and hear it for yourself. 🤍i’m curious to know however: Q: What music reminds you of Winter?
      la la land (2016) - the look of LOVE. 💜 “I’m always gonna love you.” hits different when you know the ending to this film. it shows that even in alternate versions of our lives, we think about what could have been. and more realistically: letting go of what could be 🤍.how beautiful, for #lalaland to give us that bittersweet heartfelt ending? one that will always be remembered. Q: Which La La Land moment was your favourite?
      Iconic Squid Game Characters as Croissants II 🥐✨you asked? we’ll deliver! fresh from the oven, are 9 new Squid Game Croissants served in character form. quick! eat it before it’s cold. 🤍@dizzypumpkinart and I partnered together again to have these croissants special made for you and your favourite characters ;). shoutout to @squidgamenetflix & @squidgameunleashed for making our day by supporting our previous post 🎀 this one’s for you! Q: Which Squid Game croissant is your favourite?
    `;

    // Call the function
    const result = await generateEmailSnippets(username, email, captions, bio);

    // Log the results
    console.log("Generated Email Snippet 1:");
    console.log(result.snippet1);
    console.log("\nGenerated Email Snippet 2 (Top Influencers):");
    console.log(result.snippet2);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
testGenerateEmailSnippets();