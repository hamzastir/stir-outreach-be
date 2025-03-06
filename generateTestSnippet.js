import { db } from "./src/db/primaryDb.js";
import { createAxiosInstance } from "./src/utility/axiosInstance.js";
import { withRetry } from "./src/utility/startCampaign.js";

export const getEmailId = async () => {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const response = await api.get(`email-accounts`);
    if (!response.data) {
      throw new Error("something went wrong");
    }
    console.log("✅ EMail fetch Successfully : "+ JSON.stringify(response?.data));
    return true;
  }, "Email account");
};
// const data = await getEmailId();
// console.log({data})

async function getTopInfluencers() {
  try {
    const influencers = await db("influencer_onboarded")
      .select("handle")
      .where("onboard_completed", true)
      .andWhere("onboarded_at", ">=", db.raw("NOW() - INTERVAL '15 days'"))
      .orderBy("total_audience", "desc") // Sorting by audience size
      .limit(2); 

    if (influencers.length === 0) {
      return ""; // Return empty if no influencers are found
    }

    // Extract handles and format the message
    const handles = influencers.map((i) => `@${i.handle}`);
    const firstTwo = handles.join(", ");

    const numbers = [20, 21, 22, 23, 26, 27, 28];
    const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];

    return `${firstTwo} + ${randomNumber} others have recently got their exclusive access to Stir!`;
  } catch (error) {
    console.error("Error fetching top influencers:", error);
    return "";
  }
}
const dbresult = await getTopInfluencers();
console.log({dbresult})