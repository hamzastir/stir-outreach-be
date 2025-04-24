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
