import dotenv from  "dotenv"
dotenv.config();
export const config = {
  API_KEY: process.env.SMARTLEAD_API_KEY,
  BASE_URL: "https://server.smartlead.ai/api/v1", 
  CALENDLY_BASE_URL: process.env.CALENDLY_URL,
  ONBOARDING_BASE_URL: process.env.ONBOARDING_URL,
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
};