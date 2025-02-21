import axios from 'axios'
import dotenv from  "dotenv"
dotenv.config(); // Load environment variables

const API_KEY = process.env.SMARTLEAD_API_KEY; // Set your SmartLead API key in environment variables
const EMAIL_FROM = process.env.EMAIL_FROM; // Set your email address in environment variables
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD; // Set your email app password in environment variables
const EMAIL_NAME = process.env.EMAIL_NAME; //
// Function to create a new email account
async function createEmailAccount() {
  const url = `https://server.smartlead.ai/api/v1/email-accounts/save?api_key=${API_KEY}`;
  const data = {
    id: null, // Set to null to create a new email account
    from_name: EMAIL_NAME,
    from_email: EMAIL_FROM,
    user_name: EMAIL_FROM,
    password: EMAIL_APP_PASSWORD,
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    imap_host: "imap.gmail.com",
    imap_port: 993,
    max_email_per_day: 100,
    custom_tracking_url: "",
    bcc: "",
    signature: "",
    warmup_enabled: true, // Set to true to enable warmup
    total_warmup_per_day: 30,
    daily_rampup: 2, // Set value to enable ramp-up
    reply_rate_percentage: null,
    client_id: null, // Set value to assign to a client
  };

  try {
    const response = await axios.post(url, data);
    console.log("Email account created:", response.data.emailAccountId);
    return response.data.emailAccountId; // Return the email account ID
  } catch (error) {
    console.error(
      "Error creating email account:",
      error.response ? error.response.data : error.message
    );
  }
}

// Function to create a campaign
async function createCampaign() {
  const url = `https://server.smartlead.ai/api/v1/campaigns/create?api_key=${API_KEY}`;
  const data = {
    name: "CreateStir Email Marketing Campaign",
    // client_id: 22 // Set to null if no client
  };

  try {
    const response = await axios.post(url, data);
    console.log("Campaign created:", response.data.id);
    return response.data.id; // Return the campaign ID
  } catch (error) {
    console.error(
      "Error creating campaign:",
      error.response ? error.response.data : error.message
    );
  }
}
async function updateCampaignSettings(campaignId) {
  const url = `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/settings?api_key=${API_KEY}`;
  const data = {
    track_settings: ["DONT_TRACK_EMAIL_OPEN", "DONT_TRACK_LINK_CLICK"],
  };

  try {
    const response = await axios.post(url, data);
    console.log("Campaign settings updated:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error updating campaign settings:",
      error.response ? error.response.data : error.message
    );
  }
}

// Function to add email account to a campaign
async function addEmailAccountToCampaign(campaignId, emailAccountIds) {
  const url = `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/email-accounts?api_key=${API_KEY}`;
  const data = {
    email_account_ids: emailAccountIds,
  };

  try {
    const response = await axios.post(url, data);
    console.log("Email account added to campaign:", response.data);
  } catch (error) {
    console.error(
      "Error adding email account to campaign:",
      error.response ? error.response.data : error.message
    );
  }
}

// Main function to execute the process
async function main() {
  // await createEmailAccount();
  // await createCampaign();
  await addEmailAccountToCampaign(1542514, [5940901]);
  await updateCampaignSettings(1542514);
}

// Run the main function
main();
