import express from "express";
import { db } from "../db/db.js";

const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    // Get page and limit from query parameters, with default values
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page

    // Calculate the offset based on page and limit
    const offset = (page - 1) * limit;

    // Fetch paginated user data where email exists
    const users = await db("insta_users")
      .leftJoin("insta_users_emails", "insta_users.user_id", "insta_users_emails.user_id")
      .leftJoin("stir_outreach_dashboard", "insta_users_emails.email", "stir_outreach_dashboard.business_email")
      .distinct(
        "insta_users.user_id",
        "insta_users.username",
        "insta_users.biography",
        "insta_users.followers_count",
        "insta_users_emails.email",
        "stir_outreach_dashboard.first_email_status"
      )
      .whereNotNull("insta_users_emails.email") // Ensures only users with an email are fetched
      .where(function () {
        this.whereNull("stir_outreach_dashboard.business_email") // Case when email is not in stir_outreach_dashboard
            .orWhere("stir_outreach_dashboard.first_email_status", "<>", "yet_to_schedule"); // Case when email exists but first_email_status is not 'yet_to_schedule'
      })
      .limit(limit)
      .offset(offset);

    // Fetch the total count of users (to calculate the total number of pages)
    const totalCountResult = await db("insta_users")
      .leftJoin("insta_users_emails", "insta_users.user_id", "insta_users_emails.user_id")
      .leftJoin("stir_outreach_dashboard", "insta_users_emails.email", "stir_outreach_dashboard.business_email")
      .count("insta_users.user_id as total_count")
      .whereNotNull("insta_users_emails.email") // Ensures only users with an email are counted
      .where(function () {
        this.whereNull("stir_outreach_dashboard.business_email")
            .orWhere("stir_outreach_dashboard.first_email_status", "<>", "yet_to_schedule");
      })
      .first();

    const totalCount = totalCountResult?.total_count || 0;
    const totalPages = Math.ceil(totalCount / limit); // Calculate total pages

    // Return the paginated response with count and total pages
    res.status(200).json({
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages,
      users,
    });
  } catch (error) {
    console.error("Error fetching Instagram users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
