import axios from "axios";
import dotenv from "dotenv";
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
    from_name: 'yug',
    from_email: 'yug@createstir.com',
    user_name: 'yug dave',
    password: 'evbx buyc vxiq jgci',
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

async function main() {
  await createEmailAccount();
}

// Run the main function
main();
