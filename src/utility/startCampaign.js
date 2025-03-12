import { generateEmailBody } from "../utility/generateEmailBody.js";
import { createAxiosInstance } from "../utility/axiosInstance.js";
import { config } from "../config/index.js";
import generateEmailSnippets from "./createSnippet.js";
import { db } from "../db/db.js";
import { data } from "../../sendemail.js";

let cachedRecipients = null;
const pocEmailAccountMapping = {
  // "saif@createstir.com": 5940901,
  "yug@createstir.com": 5909762,
  // "akshat@createstir.com": 5916763,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async (operation, name) => {
  for (let attempt = 1; attempt <= config.MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${attempt} failed for ${name}`);

      if (attempt === config.MAX_RETRIES) {
        throw error;
      }

      const delayTime = config.RETRY_DELAY * attempt;
      console.log(`Retrying in ${delayTime / 1000} seconds...`);
      await delay(delayTime);
    }
  }
};

async function getUsersToSchedule() {
  try {
    const users = await db("stir_outreach_dashboard")
      .select(
        "user_id",
        "username",
        "name",
        "business_email",
        "poc",
        "poc_email_address",
        "campaign_id"
      )
      .where("first_email_status", "yet_to_schedule")
      .limit(10);

    console.log("Users fetched from database:", users);
    return users;
  } catch (error) {
    console.error("Error fetching users to schedule:", error);
    throw error;
  }
}

async function getUserPostsAndBio(userId, username) {
  try {
    // Find matching user by username, or fall back to first user if not found
    const userData = data.users.find(user => user.username === username) || data.users[0];
    
    return {
      user_id: userId,
      username: username, // Use the correct username from DB
      biography: userData.biography || "",
      captions: userData.last_five_captions ? userData.last_five_captions.slice(0, 4) : [],
      taken_at: new Date(),
    };
  } catch (error) {
    console.error("Error fetching user posts and bio from outreach.js:", error);
    throw error;
  }
}

export async function prepareRecipients() {
  if (cachedRecipients) {
    console.log("Using cached recipients:", cachedRecipients);
    return cachedRecipients;
  }

  try {
    const usersToSchedule = await getUsersToSchedule();
    console.log("Users to schedule:", usersToSchedule);

    if (!usersToSchedule || usersToSchedule.length === 0) {
      console.log("No users found to schedule");
      return [];
    }

    const recipients = await Promise.all(
      usersToSchedule.map(async (user) => {
        console.log(`Processing user:`, user);

        // Get user data from our data.js mapping - now using username to match
        const userData = await getUserPostsAndBio(user.user_id, user.username);
        
        console.log("Generating snippet for ", userData.username);
        
        // Use the email from the backend (DB) as primary source
        const userEmail = user.business_email;
        
        const { snippet1, snippet2 } = await generateEmailSnippets(
          userData.username,
          userEmail,
          userData.captions,
          userData.biography
        );
        return {
          campaign_id: user.campaign_id,
          poc: user.poc,
          poc_email: user.poc_email_address,
          email: userEmail,
          firstName: userData.username, // This should now match the DB username
          snippet1: snippet1,
          snippet2: snippet2,
        };
      })
    );

    console.log("Final recipients:", recipients);
    cachedRecipients = recipients;
    return recipients;
  } catch (error) {
    console.error("Error preparing recipients:", error);
    throw error;
  }
}

// Rest of the code remains the same
export async function createNewCampaign() {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const data = {
      name: "CreateStir Email Marketing Campaign",
    };

    const response = await api.post("campaigns/create", data);
    console.log("✅ Campaign created:", response.data.id);
    return response.data.id;
  }, "createNewCampaign");
}

export async function addEmailAccountToCampaign(campaignId) {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const data = {
      email_account_ids: Object.values(pocEmailAccountMapping),
    };

    const response = await api.post(
      `campaigns/${campaignId}/email-accounts`,
      data
    );
    console.log("✅ Email accounts added to campaign:", response.data);
    return response.data;
  }, "addEmailAccountToCampaign");
}

export async function updateCampaignSettings(campaignId) {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const data = {
      track_settings: ["DONT_TRACK_EMAIL_OPEN", "DONT_TRACK_LINK_CLICK"],
    };

    const response = await api.post(`campaigns/${campaignId}/settings`, data);
    console.log("✅ Campaign settings updated:", response.data);
    return response.data;
  }, "updateCampaignSettings");
}

export const updateCampaignSchedule = async (campaignId) => {
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
      start_hour: "21:00", // 9 PM IST
      end_hour: "23:59",
      min_time_btw_emails: 3,
      max_new_leads_per_day: 100,
    };

    const response = await api.post(
      `campaigns/${campaignId}/schedule`,
      schedulePayload
    );
    console.log("✅ Campaign Schedule Updated Successfully:", response.data);
    return response.data;
  }, "updateCampaignSchedule");
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const addLeadsToCampaign = async (campaignId) => {
  try {
    const recipients = await prepareRecipients();
    console.log("Recipients for adding leads:", recipients);

    const validLeads = recipients
      .filter((r) => validateEmail(r.email))
      .map((recipient) => ({
        email: recipient.email,
        first_name: recipient.firstName,
        custom_fields: {
          snippet1: recipient.snippet1,
          snippet2: recipient.snippet2,
          poc_email: recipient.poc_email, // Optional
        },
      }));

    if (validLeads.length === 0) {
      throw new Error("No valid leads to add to campaign");
    }

    console.log("Sending validated leads:", validLeads);

    const response = await withRetry(async () => {
      const api = createAxiosInstance();
      const response = await api.post(`campaigns/${campaignId}/leads`, {
        lead_list: validLeads,
        settings: {
          ignore_global_block_list: true,
          ignore_unsubscribe_list: false,
          ignore_duplicate_leads_in_other_campaign: false,
        },
      });
      console.log("✅ Leads Added Successfully:", response.data);
      return response.data;
    }, "addLeadsToCampaign");
    

    // Extract the emails that were successfully scheduled
    const scheduledEmails = validLeads.map((lead) => lead.email);

    if (scheduledEmails.length > 0) {
      await db("stir_outreach_dashboard")
        .whereIn("business_email", scheduledEmails)
        .update({ first_email_status: "scheduled", campaign_id: campaignId });

      console.log("✅ Updated first_email_status to 'scheduled' in DB");
    }

    return response;
  } catch (error) {
    console.error("Error in addLeadsToCampaign:", error);
    throw error;
  }
};

export const createCampaignSequence = async (campaignId) => {
  try {
    const recipients = await prepareRecipients();
    console.log("Recipients for sequence creation:", recipients);

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients found to create campaign sequence");
    }

    return await withRetry(async () => {
      const api = createAxiosInstance();

      const sequenceVariants = await Promise.all(
        recipients.map(async (recipient, index) => ({
          subject: `Stir <> @${recipient.firstName} | {Curated collabs with filmmakers|We're an invite-only platform for film influencers}`,
          email_body: await generateEmailBody({
            ...recipient,
            snippet1: recipient.snippet1,
            snippet2: recipient.snippet2,
          }),
          variant_label: `Variant_${index + 1}`,
        }))
      );

      console.log("Sequence variants created:", sequenceVariants);

      const sequencePayload = {
        sequences: [
          {
            seq_number: 1,
            seq_delay_details: { delay_in_days: 0 },
            seq_variants: sequenceVariants,
          },
        ],
      };

      const response = await api.post(
        `campaigns/${campaignId}/sequences`,
        sequencePayload
      );
      console.log("✅ Campaign Sequence Created Successfully:", response.data);
      return response.data;
    }, "createCampaignSequence");
  } catch (error) {
    console.error("Error in createCampaignSequence:", error);
    throw error;
  }
};

export const startCampaign = async (campaignId) => {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const response = await api.post(`campaigns/${campaignId}/status`, {
      status: "START",
    });
    console.log("✅ Campaign Started Successfully:", response.data);
    return response.data;
  }, "startCampaign");
};

export const validateCampaignSetup = async (campaignId) => {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const response = await api.get(`campaigns/${campaignId}`);
    if (!response.data) {
      throw new Error("Campaign not found");
    }
    console.log("✅ Campaign Validated Successfully");
    return true;
  }, "validateCampaignSetup");
};