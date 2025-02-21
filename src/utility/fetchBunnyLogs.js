import axios from "axios";
import { config } from "../config/index.js";
export const getCurrentDate = () => {
  const date = new Date();
  // BunnyCDN expects format: MM-DD-YY
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}-${String(date.getFullYear()).slice(-2)}`;
};

export const fetchBunnyCDNLogs = async () => {
  const currentDate = getCurrentDate();
  const url = `https://logging.bunnycdn.com/${currentDate}/${config.PULL_ZONE_ID}.log`;

  try {
    const response = await axios.get(url, {
      headers: {
        AccessKey: config.LOGGING_API_KEY,
        "Accept-Encoding": "gzip",
        "Content-Type": "application/json",
      },
    });

    const data = response.data;
    // If no data, return empty array
    if (!data || !data.trim()) {
      console.log(`No logs found for date: ${currentDate}`);
      return [];
    }

    return data
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((entry) => {
        const [
          cacheStatus,
          statusCode,
          timestamp,
          bytesSent,
          pullZoneId,
          remoteIp,
          refererUrl,
          url,
          edgeLocation,
          userAgent,
          uniqueRequestId,
          countryCode,
        ] = entry.split("|");

        return {
          cacheStatus,
          statusCode,
          timestamp: new Date(parseInt(timestamp)),
          bytesSent: parseInt(bytesSent),
          pullZoneId,
          remoteIp,
          refererUrl,
          url,
          edgeLocation,
          userAgent,
          uniqueRequestId,
          countryCode,
        };
      });
  } catch (error) {
    // Handle 404 gracefully
    if (error.response && error.response.status === 404) {
      console.log(`No logs available for date: ${currentDate}`);
      return [];
    }
    
    // Log other errors
    console.error("Error fetching BunnyCDN logs:", {
      status: error.response?.status,
      message: error.message,
      date: currentDate
    });
    
    return [];
  }
};