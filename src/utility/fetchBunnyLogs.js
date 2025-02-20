import axios from "axios";
export const getCurrentDate = () => {
    const date = new Date();
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
    if (!data.trim()) return [];

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
    console.error("Error fetching logs:", error);
    throw error;
  }
};