import { createAxiosInstance } from "../utility/axiosInstance.js";
import generateEmailSnippets from "./createSnippet.js";
import { db } from "../db/db.js";
import { fetchUserInfo, fetchUserPosts } from "./instaApi.js";

let cachedRecipientsByPoc = {};
const pocEmailAccountMapping = {
  // "saif@createstir.com": 5940901,
  "yug@createstir.com": 5909762,
"akshat@createstir.com": 5916763,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async (operation, name) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${attempt} failed for ${name}`);

      if (attempt === 3) {
        throw error;
      }

      const delayTime = 5000 * attempt;
      console.log(`Retrying in ${delayTime / 1000} seconds...`);
      await delay(delayTime);
    }
  }
};

async function getUsersToSchedule(pocFilter = null, limit = null) {
  try {
    try {
      await db.raw('SELECT 1');
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return [];
    }

    // Base query
    let query = db("stir_outreach_dashboard")
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
    
    // Apply POC filter if provided
    if (pocFilter) {
      query = query.andWhere("poc", pocFilter);
    }
    if (limit) {
      query = query.limit(limit);
    }
    const users = await query;

    console.log(`Users fetched from database: ${users.length} users${pocFilter ? ` for POC ${pocFilter}` : ''}`);

    if (users.length === 0) return [];

    // Extract usernames from the users
    const usernames = users.map((user) => user.username);

    // Check which users are already onboarded
    let onboardedUsernames = new Set();
    try {
      // Use the primary DB if available, but don't fail if it's not
      const { db: pdb } = await import("../db/primaryDb.js");
      await pdb.raw('SELECT 1');
      console.log('✅ Primary database connection successful');
      
      // Fetch existing usernames from influencer_onboarded in pdb
      const onboardedUsers = await pdb("influencer_onboarded")
        .select("handle")
        .whereIn("handle", usernames);

      onboardedUsernames = new Set(
        onboardedUsers.map((user) => user.handle)
      );
      
      console.log(`Found ${onboardedUsernames.size} onboarded users in primary DB`);
    } catch (pdbError) {
      console.error('❌ Primary database connection failed:', pdbError);
      console.log('Proceeding with all users since we cannot check onboarded status');
    }

    // Filter users whose username is NOT in influencer_onboarded
    const filteredUsers = users.filter(
      (user) => !onboardedUsernames.has(user.username)
    );

    console.log("Filtered users (not onboarded):", filteredUsers.length);
    return filteredUsers;
  } catch (error) {
    console.error("Error fetching users to schedule:", error);
    throw error;
  }
}

async function fetchInstagramUserData(username) {
  console.log(`Fetching Instagram data for ${username}...`);
  try {
    // Fetch user info and posts in parallel
    const [userInfoResponse, userPostsResponse] = await Promise.all([
      fetchUserInfo(username),
      fetchUserPosts(username),
    ]);

    // Extract captions from posts
    const captions = [];
    if (userPostsResponse?.items && userPostsResponse.items.length > 0) {
      const posts = userPostsResponse.items.slice(0, 5);
      for (const post of posts) {
        if (post?.caption?.text) {
          captions.push(post.caption.text);
        }
      }
    }

    // Create and return user data object
    return {
      username: username,
      biography: userInfoResponse?.biography || "",
      public_email: userInfoResponse?.public_email || null,
      last_five_captions: captions,
    };
  } catch (error) {
    console.error(`Error fetching Instagram data for ${username}:`, error);
    // Return minimal data in case of error
    return {
      username: username,
      biography: "",
      public_email: null,
      last_five_captions: [],
    };
  }
}

export async function prepareRecipients(poc = null) {
  // Check if we have cached recipients for this POC
  const cacheKey = poc || 'default';
  if (cachedRecipientsByPoc[cacheKey]) {
    console.log(`Using cached recipients for ${cacheKey}:`, cachedRecipientsByPoc[cacheKey].length);
    return cachedRecipientsByPoc[cacheKey];
  }

  try {
    const usersToSchedule = await getUsersToSchedule(poc, 20);

    if (!usersToSchedule || usersToSchedule.length === 0) {
      console.log(`No users found to schedule ${poc ? `for POC ${poc}` : ''}`);
      return [];
    }

    // Process users in batches to avoid rate limiting
    const batchSize = 5;
    const allRecipients = [];
    
    for (let i = 0; i < usersToSchedule.length; i += batchSize) {
      const batch = usersToSchedule.slice(i, i + batchSize);
      console.log(`Processing batch ${i/batchSize + 1} of ${Math.ceil(usersToSchedule.length/batchSize)}`);
      
      const batchPromises = batch.map(async (user) => {
        try {
          // Fetch Instagram data directly instead of using static data
          const userData = await fetchInstagramUserData(user.username);
          console.log(`Generating snippet for ${userData.username} (POC: ${user.poc})`);
          console.log("under start capaignn")
          console.log(userData);

          // Use the email from the database as primary source
          const userEmail = user.business_email || userData.public_email;

          if (!userEmail) {
            console.log(`No email found for ${userData.username}, skipping`);
            return null;
          }

          // Generate snippets using the fetched Instagram data
          const { snippet1, snippet2 } = await generateEmailSnippets(
            userData.username,
            // userEmail,
            userData.last_five_captions,
            userData.biography
          );

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

          return recipient;
        } catch (error) {
          console.error(`Error processing user ${user.username}:`, error);
          return null;
        }
      });

      // Wait for all promises in this batch to resolve
      const batchResults = await Promise.all(batchPromises);
      
      // Add valid results to the recipients list
      allRecipients.push(...batchResults.filter(Boolean));
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < usersToSchedule.length) {
        console.log(`Waiting before processing next batch...`);
        await delay(3000);
      }
    }

    console.log(`Final recipients${poc ? ` for POC ${poc}` : ''}:`, allRecipients.length);
    cachedRecipientsByPoc[cacheKey] = allRecipients;
    return allRecipients;
  } catch (error) {
    console.error(`Error preparing recipients${poc ? ` for POC ${poc}` : ''}:`, error);
    throw error;
  }
}

export async function createNewCampaign(poc = null) {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const campaignName = poc 
      ? `CreateStir Email Marketing Campaign - ${poc}` 
      : "CreateStir Email Marketing Campaign";
    
    const data = { name: campaignName };

    const response = await api.post("campaigns/create", data);
    console.log(`✅ Campaign created${poc ? ` for ${poc}` : ''}:`, response.data.id);
    return response.data.id;
  }, `createNewCampaign${poc ? `-${poc}` : ''}`);
}

export async function addEmailAccountToCampaign(campaignId, poc = null) {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    
    let emailAccountIds;
    
    if (poc) {
      // Get the email account ID for this specific POC
      const pocEmail = `${poc.toLowerCase()}@createstir.com`;
      const emailAccountId = pocEmailAccountMapping[pocEmail];
      
      if (!emailAccountId) {
        console.error(`No email account mapping found for POC: ${poc} (${pocEmail})`);
        throw new Error(`No email account mapping found for POC: ${poc}`);
      }
      
      emailAccountIds = [emailAccountId]; // Only add the email account for this POC
      console.log(`Using email account ${emailAccountId} for POC ${poc}`);
    } else {
      // Default behavior - use Akshat's account as in the original code
      emailAccountIds = [pocEmailAccountMapping["yug@createstir.com"]];
      console.log(`Using default email account ${emailAccountIds[1]}`);
    }
    
    const data = { email_account_ids: emailAccountIds };

    const response = await api.post(
      `campaigns/${campaignId}/email-accounts`,
      data
    );
    console.log(`✅ Email account${poc ? ` for ${poc}` : ''} added to campaign:`, response.data);
    return response.data;
  }, `addEmailAccountToCampaign${poc ? `-${poc}` : ''}`);
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
        timezone: "Etc/GMT-7", // Using the specified timezone with UTC+07:00 offset
        days_of_the_week: [1, 2, 3, 4, 5], // Monday to Friday
        // start_hour: currentTimeFormatted,
        start_hour: "08:00", // Start at 08:00
        end_hour: "15:00",   // End at 14:00
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
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const addLeadsToCampaign = async (campaignId, poc = null) => {
  try {
    const recipients = await prepareRecipients(poc);
    console.log(`Recipients for adding leads${poc ? ` to ${poc} campaign` : ''}:`, recipients.length);

    // Filter valid recipients first
    const validRecipients = recipients.filter((r) => validateEmail(r.email));

    if (validRecipients.length === 0) {
      throw new Error(`No valid leads to add to${poc ? ` ${poc}` : ''} campaign`);
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

    console.log(`Sending ${validLeads.length} validated leads${poc ? ` for ${poc} campaign` : ''}`);

    const response = await withRetry(async () => {
      const api = createAxiosInstance();
      const response = await api.post(`campaigns/${campaignId}/leads`, {
        lead_list: validLeads,
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: true,
          ignore_duplicate_leads_in_other_campaign: false,
        },
      });
      console.log(`✅ Leads Added Successfully${poc ? ` to ${poc} campaign` : ''}:`, response.data);
      return response.data;
    }, `addLeadsToCampaign${poc ? `-${poc}` : ''}`);

    // Extract the emails that were successfully scheduled
    const scheduledEmails = validLeads.map((lead) => lead.email);

    if (scheduledEmails.length > 0) {
      await db("stir_outreach_dashboard")
        .whereIn("business_email", scheduledEmails)
        .update({ first_email_status: "scheduled", campaign_id: campaignId });

      console.log(`✅ Updated ${scheduledEmails.length} records with first_em
        ail_status 'scheduled' in DB${poc ? ` for ${poc}` : ''}`);
    }

    return response;
  } catch (error) {
    console.error(`Error in addLeadsToCampaign${poc ? ` for ${poc}` : ''}:`, error);
    throw error;
  }
};

export const createCampaignSequence = async (campaignId, poc = null) => {
  try {
    console.log(`Creating sequence${poc ? ` for ${poc} campaign` : ''}`);

    return await withRetry(async () => {
      const api = createAxiosInstance();

      const sequencePayload = {
        sequences: [
          {
            seq_number: 1,
            seq_delay_details: { delay_in_days: 0 },
            seq_variants: [
              {
                subject: `Stir <> @{{first_name}}| {Curated collabs with filmmakers|We're an invite-only platform for film influencers}`,
                email_body: `{Hi|Hey|Hello} @{{first_name}}, I'm {{poc}}<br>
                {{snippet1}}<br>
We're building something exciting at <b>Stir</b>—an invite-only marketplace to connect influencers like you with indie filmmakers and major studios, offering early access to upcoming releases. <br>
What makes us unique? Vetted clients. Built-in AI. Fast payments. A flat 10% take rate.<br>
 {I'd love to hear your thoughts and see if this is something you'd like to explore!|I'd love to hear your story and see if Stir is the right fit for you!}<br>
{No pressure|No rush at all|At your convenience}—feel free to reply to this email or set up a quick call here: <a href="{{calendlyUrl}}
">createstir.com/calendly</a>. Or if you're ready to dive in, you can also onboard here: <a href="{{onboardingUrl}}
">createstir.com/onboard</a>.<br>
 {Best,|Cheers,|Viva cinema,|Regards,}<br>{{poc}}
<br>VP of Stellar Beginnings!<br>
PS: {{snippet2}}
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
      console.log(`✅ Campaign Sequence Created Successfully${poc ? ` for ${poc}` : ''}:`, response.data);
      return response.data;
    }, `createCampaignSequence${poc ? `-${poc}` : ''}`);
  } catch (error) {
    console.error(`Error in createCampaignSequence${poc ? ` for ${poc}` : ''}:`, error);
    throw error;
  }
};

export const startCampaign = async (campaignId, poc = null) => {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const response = await api.post(`campaigns/${campaignId}/status`, {
      status: "START",
    });
    console.log(`✅ Campaign${poc ? ` for ${poc}` : ''} Started Successfully:`, response.data);
    return response.data;
  }, `startCampaign${poc ? `-${poc}` : ''}`);
};

export const validateCampaignSetup = async (campaignId, poc = null) => {
  return await withRetry(async () => {
    const api = createAxiosInstance();
    const response = await api.get(`campaigns/${campaignId}`);
    if (!response.data) {
      throw new Error(`Campaign${poc ? ` for ${poc}` : ''} not found`);
    }
    console.log(`✅ Campaign${poc ? ` for ${poc}` : ''} Validated Successfully`);
    return true;
  }, `validateCampaignSetup${poc ? `-${poc}` : ''}`);
};

// Function to create campaigns for all POCs
export const createCampaignsByPoc = async () => {
  try {
    // List of POCs to create campaigns for
    const pocs = ["Akshat", "Yug"]; // Add more POCs as needed
    const campaignResults = [];
    
    for (const poc of pocs) {
      console.log(`\n📍 Starting campaign creation for POC: ${poc}`);
      
      // Check if we have recipients for this POC
      const recipients = await prepareRecipients(poc);
      
      if (!recipients || recipients.length === 0) {
        console.log(`No recipients found for POC ${poc}, skipping campaign creation`);
        continue;
      }
      
      // Create new campaign for this POC
      const campaignId = await createNewCampaign(poc);
      
      // Add email account specific to this POC
      await addEmailAccountToCampaign(campaignId, poc);
      
      // Update campaign settings
      await updateCampaignSettings(campaignId);
      
      // Update campaign schedule
      await updateCampaignSchedule(campaignId);
      
      // Add leads to campaign
      await addLeadsToCampaign(campaignId, poc);
      
      // Create campaign sequence
      await createCampaignSequence(campaignId, poc);
      
      // Validate campaign setup
      await validateCampaignSetup(campaignId, poc);
      
      // Start campaign
      await startCampaign(campaignId, poc);
      
      campaignResults.push({ poc, campaignId });
      console.log(`✅ Campaign for POC ${poc} created successfully with ID: ${campaignId}`);
    }
    
    return campaignResults;
  } catch (error) {
    console.error("Error creating campaigns by POC:", error);
    throw error;
  }
};