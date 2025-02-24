import { generateEmailBody } from "../utility/generateEmailBody.js";
import { createAxiosInstance } from "../utility/axiosInstance.js";
import { config } from "../config/index.js";
import generateEmailSnippets from "./createSnippet.js";
import { db } from "../db/db.js";
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
    return await db("stir_outreach_dashboard")
      .select("user_id", "username", "name", "business_email")
      .where("first_email_status", "yet_to_schedule")
      .limit(10);
  } catch (error) {
    console.error("Error fetching users to schedule:", error);
    throw error;
  }
}

// Function to get user's posts and bio
async function getUserPostsAndBio(userId) {
  try {
    return await db("insta_users as u")
      .select([
        "u.user_id",
        "u.username",
        "u.biography",
        "p.caption",
        "p.taken_at",
      ])
      .leftJoin("insta_posts as p", "u.user_id", "p.user_id")
      .where("u.user_id", 111)
      .orderBy("p.taken_at", "desc")
      .limit(4);
  } catch (error) {
    console.error("Error fetching user posts and bio:", error);
    throw error;
  }
}

export async function prepareRecipients() {
  try {
    // Get users who need emails scheduled
    const usersToSchedule = await getUsersToSchedule();

    // Prepare recipients array
    const recipients = await Promise.all(
      usersToSchedule.map(async (user) => {
        // Get user's posts and bio
        const userPosts = await getUserPostsAndBio(user.user_id);

        // Extract captions from posts
        const captions = userPosts.map((post) => post.caption).filter(Boolean);
   
        const bio = userPosts[0]?.biography || "";
        const { snippet1, snippet2 } = await generateEmailSnippets(
          user.username,
          user.business_email,
          captions,
          bio
        );
        return {
          email: user.business_email,
          firstName: user.username, // Using username instead of firstName
          snippet1,
          snippet2,
        };
      })
    );
    return recipients;
  } catch (error) {
    console.error("Error preparing recipients:", error);
    throw error;
  }
}

export async function createNewCampaign() {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const data = {
      name: "CreateStir Email Marketing Campaign",
    };

    const response = await api.post('campaigns/create', data);
    console.log("✅ Campaign created:", response.data.id);
    return response.data.id;
  }, "createNewCampaign");
}

export async function addEmailAccountToCampaign(campaignId) {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const data = {
      email_account_ids: [5940901], // Using constant email account ID
    };

    const response = await api.post(`campaigns/${campaignId}/email-accounts`, data);
    console.log("✅ Email account added to campaign:", response.data);
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
      days_of_the_week: [0, 1, 2, 3, 4, 5, 6],
      start_hour: currentTimeFormatted,
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

const prepareLead = (recipient) => {
  return {
    email: recipient.email,
    first_name: recipient.firstName,
    custom_fields: {
      snippet1: recipient.snippet1,
      snippet2: recipient.snippet2,
    },
  };
};

export const addLeadsToCampaign = async (campaignId) => {
  // Get recipients from database
  const recipients = await prepareRecipients();
  const validLeads = recipients
  .filter((r) => validateEmail(r.email))
  .map((r) => prepareLead(r));
  
  console.log({validLeads})
  if (validLeads.length === 0) {
    throw new Error("No valid leads to add to campaign");
  }
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const response = await api.post(`campaigns/${campaignId}/leads`, {
      lead_list: validLeads,
      settings: {
        ignore_global_block_list: true,
        ignore_unsubscribe_list: false,
        // ignore_duplicate_leads_in_other_campaign: false,
      },
    });

    console.log("✅ Leads Added Successfully:", response.data);
    return response.data;
  }, "addLeadsToCampaign");
};

export const createCampaignSequence = async (campaignId) => {
  const recipients = await prepareRecipients();

  return await withRetry(async () => {
    const api = createAxiosInstance();
    const sequenceVariants = await Promise.all(
      recipients.map(async (recipient, index) => ({
        subject: `Hi ${recipient.firstName}, Let's Connect!`,
        email_body: await generateEmailBody({
          ...recipient,
          snippet1: recipient.snippet1,
          snippet2: recipient.snippet2,
        }),
        variant_label: `Variant_${index + 1}`,
      }))
    );

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
