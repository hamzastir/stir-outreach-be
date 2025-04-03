import { createAxiosInstance } from "./src/utility/axiosInstance.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (operation, name) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${attempt} failed for ${name}`);

      if (attempt === MAX_RETRIES) {
        throw error;
      }

      const delayTime = RETRY_DELAY * attempt;
      console.log(`Retrying in ${delayTime / 1000} seconds...`);
      await delay(delayTime);
    }
  }
};

async function createNewCampaign() {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const campaignName = "Test Campaign - Akshat";
    
    const data = { name: campaignName };

    const response = await api.post("campaigns/create", data);
    console.log(`✅ Campaign created:`, response.data.id);
    return response.data.id;
  }, "createNewCampaign");
}

async function addEmailAccountToCampaign(campaignId) {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    
    // Using Akshat's email account
    const emailAccountIds = [5916763]; // Akshat's account ID
    console.log(`Using Akshat's email account ${emailAccountIds[0]}`);
    
    const data = { email_account_ids: emailAccountIds };

    const response = await api.post(
      `campaigns/${campaignId}/email-accounts`,
      data
    );
    console.log(`✅ Email account added to campaign:`, response.data);
    return response.data;
  }, "addEmailAccountToCampaign");
}

async function updateCampaignSchedule(campaignId) {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const now = new Date();
    const istTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const currentHour = istTime.getHours();
    const currentMinute = istTime.getMinutes();

    const currentTimeFormatted = `${currentHour
      .toString()
      .padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
    const schedulePayload = {
      timezone: "Asia/Kolkata",
      days_of_the_week: [1, 2, 3, 4, 5], // Monday to Friday
      start_hour: currentTimeFormatted, // 9 PM IST
      end_hour: "23:59",
      min_time_btw_emails: 9,
      max_new_leads_per_day: 100,
    };

    const response = await api.post(
      `campaigns/${campaignId}/schedule`,
      schedulePayload
    );
    console.log("✅ Campaign Schedule Updated Successfully:", response.data);
    return response.data;
  }, "updateCampaignSchedule");
}

async function addLeadsToCampaign(campaignId) {
  try {
    // Simple array of test emails
    const testEmails = [
      "inajksdyh1@invalid.com",
      "axxatagrawal@gmail.com.com",
      "test3iaoj@example.com"
    ];
    
    console.log(`Adding ${testEmails.length} test emails to campaign`);

    // Create leads from emails
    const leads = testEmails.map(email => ({
      email: email,
      first_name: email.split('@')[0], // Use part before @ as first name
    }));

    const response = await withRetry(async () => {
      const api = createAxiosInstance();
      const response = await api.post(`campaigns/${campaignId}/leads`, {
        lead_list: leads,
        settings: {
          ignore_global_block_list: true,
          ignore_unsubscribe_list: true,
          ignore_duplicate_leads_in_other_campaign: true,
        },
      });
      console.log(`✅ Leads Added Successfully:`, response.data);
      return response.data;
    }, "addLeadsToCampaign");

    // Log emails that would have been updated in DB (but not actually updating DB)
    console.log(`✅ Would have updated these emails in DB: ${testEmails.join(', ')}`);

    return response;
  } catch (error) {
    console.error(`Error in addLeadsToCampaign:`, error);
    throw error;
  }
}

async function createCampaignSequence(campaignId) {
  try {
    console.log(`Creating simple test sequence`);

    return await withRetry(async () => {
      const api = createAxiosInstance();

      const sequencePayload = {
        sequences: [
          {
            seq_number: 1,
            seq_delay_details: { delay_in_days: 0 },
            seq_variants: [
              {
                subject: "Just a test email",
                email_body: "Hi how are you",
                variant_label: "Default",
              },
            ],
          },
        ],
      };

      const response = await api.post(
        `campaigns/${campaignId}/sequences`,
        sequencePayload
      );
      console.log(`✅ Campaign Sequence Created Successfully:`, response.data);
      return response.data;
    }, "createCampaignSequence");
  } catch (error) {
    console.error(`Error in createCampaignSequence:`, error);
    throw error;
  }
}

async function startCampaign(campaignId) {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const response = await api.post(`campaigns/${campaignId}/status`, {
      status: "START",
    });
    console.log(`✅ Campaign Started Successfully:`, response.data);
    return response.data;
  }, "startCampaign");
}

// Main function to run the test
async function runTestCampaign() {
  try {
    console.log("🚀 Starting test campaign creation...");
    
    // Create new campaign
    const campaignId = await createNewCampaign();
    
    // Add Akshat's email account
    await addEmailAccountToCampaign(campaignId);
    
    // Update campaign schedule
    await updateCampaignSchedule(campaignId);
    
    // Add test leads
    await addLeadsToCampaign(campaignId);
    
    // Create simple sequence
    await createCampaignSequence(campaignId);
    
    // Start campaign
    await startCampaign(campaignId);
    
    console.log(`✅ Test campaign completed successfully! Campaign ID: ${campaignId}`);
  } catch (error) {
    console.error("❌ Error running test campaign:", error);
  }
}

// Run the test
runTestCampaign();