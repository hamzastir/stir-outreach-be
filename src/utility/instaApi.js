import axios from "axios";

const API_HOST = "mediafy-api.p.rapidapi.com";
const RAPIDAPI_KEY = "6daf848de6msheffe53ac27d1889p17e2d8jsn8675487c1c0f";

export async function fetchUserInfo(username) {
  try {
    const profileResponse = await axios.get(`https://${API_HOST}/v1/info`, {
      params: {
        username_or_id_or_url: username,
        include_about: 'true',
        url_embed_safe: 'true'
      },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': API_HOST
      }
    });

    return profileResponse.data?.data;
  } catch (error) {
    console.error(`Error fetching user info for ${username}:`, error);
    return null;
  }
}

export async function fetchUserPosts(username) {
  try {
    const postsResponse = await axios.get(`https://${API_HOST}/v1/posts`, {
      params: {
        username_or_id_or_url: username,
        include_about: 'true'
      },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': API_HOST
      }
    });

    return postsResponse.data?.data;
  } catch (error) {
    console.error(`Error fetching posts for ${username}:`, error);
    return null;
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
    if (userPostsResponse?.items && userPostsResponse.items.length > 0) {
      const posts = userPostsResponse.items.slice(0, 5);
      for (const post of posts) {
        if (post?.caption?.text) {
          captions.push(post.caption.text);
        }
      }
    }

    // Create and return user data object
    return {
      username: username,
      biography: userInfoResponse?.biography || "",
      public_email: userInfoResponse?.public_email || null,
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
const test = await fetchInstagramUserData("spaceofcinema");
console.log(test);
// //
// const test2 = await fetchUserPosts("spaceofcinema");
// console.log(test2);
