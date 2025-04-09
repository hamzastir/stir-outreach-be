import axios from "axios";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables

const API_KEY = process.env.SMARTLEAD_API_KEY; // Set your SmartLead API key in environment variables
const EMAIL_FROM = process.env.EMAIL_FROM; // Set your email address in environment variables
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD; // Set your email app password in environment variables
const EMAIL_NAME = process.env.EMAIL_NAME; //
// akshat@getstir.co
// Stir@zoho123
// Function to create a new email account

// akshat.johri@getstir.co
// U5kFUX6uBwtd

// yug@getstir.co
// uyD476FYHLy8

// yug.dave@getstir.co
// 5nCtXdB1MTgG
async function createEmailAccount() {
  const url = `https://server.smartlead.ai/api/v1/email-accounts/save?api_key=eaf95559-9524-40ec-bb75-a5bf585ce25b_94ivz0y`;
  const data = {
    id: null, // Set to null to create a new email account
    from_name: '',
    from_email: 'yug.dave@getstir.co',
    user_name: 'yug.dave@getstir.co',
    password: 'gCTwtvPNPMTP',
    smtp_host: "smtp.zoho.com",
    smtp_port: 465,
    imap_host: "imap.zoho.com",
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
