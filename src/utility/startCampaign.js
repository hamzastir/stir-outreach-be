import { generateEmailBody } from "../utility/generateEmailBody.js";
import { createAxiosInstance } from "../utility/axiosInstance.js";
import { config } from "../config/index.js";
import generateEmailSnippets from "./createSnippet.js";
import { db } from "../db/db.js";
import { data } from "../../sendemail.js";
import { db as pdb } from "../db/primaryDb.js";

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
    try {
      await db.raw('SELECT 1');
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return [];
    }

    // Fetch users from stir_outreach_dashboard
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
      .where("first_email_status", "yet_to_schedule");

    console.log("Users fetched from database:", users);

    if (users.length === 0) return [];

    // Extract usernames from the users
    const usernames = users.map((user) => user.username);

    // Try to connect to primary database, handle failure gracefully
    let onboardedUsernames = new Set();
    try {
      // Test primary DB connection
      await pdb.raw('SELECT 1');
      console.log('✅ Primary database connection successful');
      
      // Fetch existing usernames from influencer_onboarded in pdb
      const onboardedUsers = await pdb("influencer_onboarded")
        .select("handle")
        .whereIn("handle", usernames);

      onboardedUsernames = new Set(
        onboardedUsers.map((user) => user.handle) // Make sure this matches the column name
      );
      
      console.log(`Found ${onboardedUsernames.size} onboarded users in primary DB`);
    } catch (pdbError) {
      console.error('❌ Primary database connection failed:', pdbError);
      console.log('Proceeding with all users since we cannot check onboarded status');
      // Continue with all users since we can't check which ones are onboarded
    }

    // Filter users whose username is NOT in influencer_onboarded
    const filteredUsers = users.filter(
      (user) => !onboardedUsernames.has(user.username)
    );

    console.log("Filtered users (not onboarded):", filteredUsers);
    return filteredUsers;
  } catch (error) {
    console.error("Error fetching users to schedule:", error);
    throw error;
  }
}

async function getUserPostsAndBio(userId, username) {
  try {
    // Find matching user by username, or fall back to first user if not found
    const userData =
      data.users.find((user) => user.username === username) || data.users[0];

    return {
      user_id: userId,
      username: username, // Use the correct username from DB
      biography: userData.biography || "",
      captions: userData.last_five_captions
        ? userData.last_five_captions.slice(0, 4)
        : [],
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
    // console.log("Users to schedule:", usersToSchedule;

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
        // const snippet1 =
        //   "this is ai generated custom snippet for : " + userData.username;
        // const snippet2 = "20 people joined today";

        const CALENDLY_BASE_URL = "https://www.createstir.com/calendly";
        const ONBOARDING_BASE_URL = "https://www.createstir.com/onboard";

        // Create the recipient object first
        const recipient = {
          campaign_id: user.campaign_id,
          poc: user.poc,
          poc_email: user.poc_email_address,
          email: userEmail,
          firstName: userData.username,
          snippet1: snippet1,
          snippet2: snippet2,
        };

        const getCampaignIdByEmail = async (email) => {
          const result = await db("stir_outreach_dashboard")
            .select("campaign_id")
            .where("business_email", email)
            .first(); // Get a single record

          return result?.campaign_id || null;
        };

        const generateParameterizedUrls = async (email, name) => {
          const campaignId = await getCampaignIdByEmail(email);

          const params = new URLSearchParams({
            email: email,
            name: name,
            id: campaignId || "",
          });

          return {
            calendlyUrl: `${CALENDLY_BASE_URL}?${params.toString()}`,
            onboardingUrl: `${ONBOARDING_BASE_URL}?${params.toString()}`,
          };
        };

        const { calendlyUrl, onboardingUrl } = await generateParameterizedUrls(
          userEmail,
          userData.username
        );

        // Add the URLs to the recipient object
        recipient.calendlyUrl = calendlyUrl;
        recipient.onboardingUrl = onboardingUrl;

        return {
          ...recipient,
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
      // start_hour: "21:00", // 9 PM IST
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

export const addLeadsToCampaign = async (campaignId) => {
  try {
    const recipients = await prepareRecipients();
    console.log("Recipients for adding leads:", recipients);

    // Filter valid recipients first
    const validRecipients = recipients.filter((r) => validateEmail(r.email));

    if (validRecipients.length === 0) {
      throw new Error("No valid leads to add to campaign");
    }

    // Generate email bodies for all valid recipients
    const validLeadsPromises = validRecipients.map(async (recipient) => {
      return {
        email: recipient.email,
        first_name: recipient.firstName,
        custom_fields: {
          snippet1: recipient.snippet1,
          snippet2: recipient.snippet2,
          poc: recipient.poc,
          calendlyUrl: recipient.calendlyUrl,
          onboardingUrl: recipient.onboardingUrl,
        },
      };
    });

    // Wait for all promises to resolve
    const validLeads = await Promise.all(validLeadsPromises);

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

      // Create a single template with personalization variables
      const sequencePayload = {
        sequences: [
          {
            seq_number: 1,
            seq_delay_details: { delay_in_days: 0 },
            seq_variants: [
              {
                subject: `Stir <> @{{first_name}} | {Curated collabs with filmmakers|We're an invite-only platform for film influencers}`,
                email_body: `{Hi|Hey|Hello} @{{first_name}}, I’m {{poc}}
                {{snippet1}}<br>
                 We’re building something exciting at <b>Stir</b>—an invite-only marketplace to connect influencers like you with indie filmmakers and major studios, offering early access to upcoming releases. <br>
What makes us unique? Vetted clients. Built-in AI. Fast payments. A flat 10% take rate.<br>
 {I’d love to hear your thoughts and see if this is something you’d like to explore!|I'd love to hear your story and see if Stir is the right fit for you!}<br>
{No pressure|No rush at all|At your convenience}—feel free to reply to this email or set up a quick call here: <a href="{{calendlyUrl}}">createstir.com/calendly</a>. Or if you’re ready to dive in, you can also onboard here: <a href="{{onboardingUrl}}">createstir.com/onboard</a>.<br>
 {Best,|Cheers,|Viva cinema,|Regards,}<br>Yug Dave<br>VP of Stellar Beginnings!<br>
PS: <p>{{snippet2}}</p>
                `,
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
