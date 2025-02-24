import { db } from "./src/db/db.js";
import generateEmailSnippets from "./src/utility/createSnippet.js";

async function getUserPostsAndBio(userId) {
  try {
    return await db("insta_users as u")
      .select([
        "u.user_id",
        "u.username",
        "u.biography",
        "p.caption",
        "p.taken_at",
      ])
      .leftJoin("insta_posts as p", "u.user_id", "p.user_id")
      .where("u.user_id", 111)
      .orderBy("p.taken_at", "desc")
      .limit(4);
  } catch (error) {
    console.error("Error fetching user posts and bio:", error);
    throw error;
  }
}

// const userPosts = await getUserPostsAndBio();
// console.log({userPosts})
// const captions = userPosts.map((post) => post.caption).filter(Boolean);
// const bio = userPosts[0]?.biography || "";
// // const { snippet1 } = await generateEmailSnippets(
// //   userPosts[0].username,
// //   captions,
// //   bio
// // );
const { snippet1 } = await generateEmailSnippets(
  "axat02",
  ["beautiful morning"],
  "I think therefore i am "
);
// console.log({ userPosts });
console.log({ snippet1 });
