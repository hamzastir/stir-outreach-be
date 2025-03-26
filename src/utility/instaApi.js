const API_HOST = "mediafy-api.p.rapidapi.com";

export async function fetchUserPosts(username) {
    const url = `https://${API_HOST}/v1/posts?username_or_id_or_url=${encodeURIComponent(
      username
    )}`;
  
    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-host": API_HOST,
        "x-rapidapi-key": "6daf848de6msheffe53ac27d1889p17e2d8jsn8675487c1c0f",
      },
    };
  
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching posts for ${username}:`, error);
      return null;
    }
  }
  export async function fetchUserInfo(username) {
    const url = `https://${API_HOST}/v1/info?username_or_id_or_url=${encodeURIComponent(username)}&url_embed_safe=true`;
  
    const options = {
      method: 'GET',
      headers: {
        "x-rapidapi-host": API_HOST,
        "x-rapidapi-key": "6daf848de6msheffe53ac27d1889p17e2d8jsn8675487c1c0f",
      },
    };
  
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching user info for ${username}:`, error);
      return null;
    }
  }