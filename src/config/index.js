import dotenv from  "dotenv"
dotenv.config();
export const config = {
  API_KEY: process.env.SMARTLEAD_API_KEY,
  BASE_URL: "https://server.smartlead.ai/api/v1", 
  CAMPAIGN_ID: process.env.CAMPAIGN_ID,
  EMAIL_ACCOUNT_ID: process.env.EMAIL_ACCOUNT_ID,
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
  PULL_ZONE_URL:process.env.PULL_ZONE_URL,
  PULL_ZONE_ID: process.env.PULL_ZONE_ID,
  LOGGING_API_KEY: process.env.LOGGING_API_KEY,
  CALENDLY_BASE_URL: process.env.CALENDLY_URL,
  ONBOARDING_BASE_URL: process.env.ONBOARDING_URL,
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
};