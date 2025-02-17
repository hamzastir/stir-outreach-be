const axios = require('axios');
require('dotenv').config(); // Load environment variables

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
        warmup_enabled: false, // Set to true to enable warmup
        total_warmup_per_day: null,
        daily_rampup: null, // Set value to enable ramp-up
        reply_rate_percentage: null,
        client_id: null // Set value to assign to a client
    };

    try {
        const response = await axios.post(url, data);
        // console.log('Email account created:', response.data);
        return response.data.emailAccountId; // Return the email account ID
    } catch (error) {
        console.error('Error creating email account:', error.response ? error.response.data : error.message);
    }
}

// Function to create a campaign
async function createCampaign() {
    const url = `https://server.smartlead.ai/api/v1/campaigns/create?api_key=${API_KEY}`;
    const data = {
        name: "CreateStir Email Automation",
        // client_id: 22 // Set to null if no client
    };

    try {
        const response = await axios.post(url, data);
        // console.log('Campaign created:', response.data);
        return response.data.id; // Return the campaign ID
    } catch (error) {
        console.error('Error creating campaign:', error.response ? error.response.data : error.message);
    }
}

// Function to add email account to a campaign
async function addEmailAccountToCampaign(campaignId, emailAccountIds) {
    const url = `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/email-accounts?api_key=${API_KEY}`;
    const data = {
        email_account_ids: emailAccountIds
    };

    try {
        const response = await axios.post(url, data);
        console.log('Email account added to campaign:', response.data);
    } catch (error) {
        console.error('Error adding email account to campaign:', error.response ? error.response.data : error.message);
    }
}

// Main function to execute the process
async function main() {
    // Step 1: Create a new email account
    const emailAccountId = await createEmailAccount();
    // if (!emailAccountId) {
    //     console.error('Failed to create email account.');
    //     return;
    // }
    console.log({emailAccountId})
    // Step 2: Create a campaign
    const campaignId = await createCampaign();
    // if (!campaignId) {
    //     console.error('Failed to create campaign.');
    //     return;
    // }
    console.log({campaignId})

    // Step 3: Add the email account to the campaign
    await addEmailAccountToCampaign(campaignId, [emailAccountId]);
}

// Run the main function
main();