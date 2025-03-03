import { db } from "../db/db.js";
import { createAxiosInstance } from "../utility/axiosInstance.js";

export const handleCalendlyClick = async (req, res, campaignId) => {
  try {
    const { name, email } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Update database
    const updateResult = await db("stir_outreach_dashboard")
      .where("business_email", email)
      .update({
        calendly_link_clicked: true,
        calendly_click_date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        calendly_click_time: new Date()
          .toISOString()
          .split("T")[1]
          .split(".")[0], // HH:MM:SS
      });

    if (updateResult === 0) {
      return res.status(404).json({
        error: "No matching record found with the provided email",
      });
    }
    console.group(updateResult);
    res.status(200).json({
      message: "Onboarding link clicked",
      data: updateResult,
    });
    // Schedule immediate follow-up
    // const api = createAxiosInstance();

    // // Follow-up sequence payload
    // const followUpSequence = {
    //   sequences: [
    //     {
    //       seq_number: 2, // Next sequence number
    //       seq_delay_details: { delay_in_days: 0 }, // Send immediately
    //       seq_variants: [
    //         {
    //           subject: `Thank you for your interest, ${name}!`,
    //           email_body: `
    //             <p>Hi ${name},</p>
    //             <p>Thank you for clicking on our calendar link! We're excited about the opportunity to connect with you.</p>
    //             <p>Please go ahead and choose a time that works best for you, and we'll make sure to have a productive conversation.</p>
    //             <p>Looking forward to speaking with you soon!</p>
    //             <p>Best regards,<br>Yug</p>
    //           `,
    //           variant_label: "Follow_Up_A",
    //         },
    //       ],
    //     },
    //   ],
    // };

    // // Add sequence to campaign
    // await api.post(`campaigns/${campaignId}/sequences`, followUpSequence);

    // // Resume the lead immediately
    // await api.post(`campaigns/${campaignId}/leads/${email}/resume`, {
    //   resume_lead_with_delay_days: 0, // Resume immediately
    // });

    // // Fetch updated record
    // const updatedRecord = await db("stir_outreach_dashboard")
    //   .select(
    //     "user_id",
    //     "username",
    //     "name",
    //     "business_email",
    //     "calendly_link_clicked",
    //     "calendly_click_date",
    //     "calendly_click_time"
    //   )
    //   .where("business_email", email)
    //   .first();

    // res.status(200).json({
    //   message: "Follow-up email scheduled",
    //   data: updatedRecord,
    // });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleOnboardingClick = async (req, res, campaignId) => {
  try {
    const { name, email } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Update database
    const updateResult = await db("stir_outreach_dashboard")
      .where("business_email", email)
      .update({
        onboarding_link_clicked: true,
        onboarding_click_date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        onboarding_click_time: new Date()
          .toISOString()
          .split("T")[1]
          .split(".")[0], // HH:MM:SS
      });

    if (updateResult === 0) {
      return res.status(404).json({
        error: "No matching record found with the provided email",
      });
    }
    console.group(updateResult);
    res.status(200).json({
      message: "Onboarding link clicked",
      data: updateResult,
    });
    // Schedule immediate follow-up
    // const api = createAxiosInstance();

    // // Follow-up sequence payload
    // const followUpSequence = {
    //   sequences: [
    //     {
    //       seq_number: 3, // Next sequence number
    //       seq_delay_details: { delay_in_days: 0 }, // Send immediately
    //       seq_variants: [
    //         {
    //           subject: `Thank you for your Onboarding, ${name}!`,
    //           email_body: `
    //             <p>Hi ${name},</p>
    //             <p>Thank you for clicking on our Onboarding link! We're excited about the opportunity to connect with you.</p>
    //             <p>Please go ahead and choose a time that works best for you, and we'll make sure to have a productive conversation.</p>
    //             <p>Looking forward to speaking with you soon!</p>
    //             <p>Best regards,<br>Yug</p>
    //           `,
    //           variant_label: "Follow_Up_B",
    //         },
    //       ],
    //     },
    //   ],
    // };

    // // Add sequence to campaign
    // await api.post(`campaigns/${campaignId}/sequences`, followUpSequence);

    // // Resume the lead immediately
    // await api.post(`campaigns/${campaignId}/leads/${email}/resume`, {
    //   resume_lead_with_delay_days: 0, // Resume immediately
    // });

    // // Fetch updated record
    // const updatedRecord = await db("stir_outreach_dashboard")
    //   .select(
    //     "user_id",
    //     "username",
    //     "name",
    //     "business_email",
    //     "calendly_link_clicked",
    //     "calendly_click_date",
    //     "calendly_click_time"
    //   )
    //   .where("business_email", email)
    //   .first();

    // res.status(200).json({
    //   message: "Follow-up email scheduled",
    //   data: updatedRecord,
    // });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
