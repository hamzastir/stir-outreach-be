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
// //   }
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

