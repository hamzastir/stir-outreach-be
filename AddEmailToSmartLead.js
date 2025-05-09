import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

async function createEmailAccount() {
  const url = `https://server.smartlead.ai/api/v1/email-accounts/save?api_key=${process.env.SMARTLEAD_API_KEY}`;

  const data = {
    id: null,
    from_name: "Ankur",
    from_email: "ankur@getstir.co",
    user_name: "ankur@getstir.co",
    password: "zwrk imrw krnk prcs",
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    imap_host: "imap.gmail.com",
    imap_port: 993,
    max_email_per_day: 100,
    custom_tracking_url: "",
    bcc: "",
    signature: "",
    warmup_enabled: true,
    total_warmup_per_day: 30,
    daily_rampup: 2,
    reply_rate_percentage: null,
    client_id: null,
  };

  try {
    const response = await axios.post(url, data);
    console.log("Email account created:", response.data.emailAccountId);
    return response.data.emailAccountId;
  } catch (error) {
    console.error(
      "Error creating email account:",
      error.response?.data || error.message
    );
  }
}

createEmailAccount();
