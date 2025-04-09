import express from "express";
import { db } from "../db/db.js";

const router = express.Router();

// GET /leads

router.get("/leads", async (req, res) => {
  try {
    const users = await db
      .select(
        "iu.user_id",
        "iu.username",
        "iu.followers_count",
        "iu.business_email",
        "pim.movie_count as total_movie_id"
      )
      .from("insta_users as iu")
      .join(
        db("post_influencer_movie_map")
          .select("user_id")
          .countDistinct("movie_id as movie_count")
          .groupBy("user_id")
          .havingRaw("COUNT(DISTINCT movie_id) >= 1")
          .as("pim"),
        "iu.user_id",
        "pim.user_id"
      )
      .whereNotNull("iu.business_email")
      .andWhere("iu.followers_count", ">", 50000)
      .whereNotIn("iu.business_email", function () {
        this.select("business_email").from("stir_outreach_dashboard");
      })
      .whereNotIn("iu.business_email", function () {
        this.select("business_email").from("influencer_outreach_irrelevant_leads");
      })
      .whereNotIn("iu.username", function () {
        this.select("username").from("influencer_outreach_irrelevant_leads");
      })
      .andWhere(function () {
        this.where(function () {
          this.where("iu.ai_category_1", "Normal Influencer")
            .andWhere("iu.ai_category_2", "<>", "Normal Influencer")
            .andWhere("iu.ai_category_3", "<>", "Normal Influencer");
        })
        .orWhere(function () {
          this.where("iu.ai_category_2", "Normal Influencer")
            .andWhere("iu.ai_category_1", "<>", "Normal Influencer")
            .andWhere("iu.ai_category_3", "<>", "Normal Influencer");
        })
        .orWhere(function () {
          this.where("iu.ai_category_3", "Normal Influencer")
            .andWhere("iu.ai_category_1", "<>", "Normal Influencer")
            .andWhere("iu.ai_category_2", "<>", "Normal Influencer");
        });
      });

    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching filtered users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// POST /mark-approved
router.post("/mark-approved", async (req, res) => {
  const { user_id, username, business_email, poc, poc_email_address } = req.body;

  if (!user_id || !username || !business_email || !poc || !poc_email_address) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const existing = await db("stir_outreach_dashboard")
      .where({ business_email })
      .first();

    if (existing) {
      return res.status(409).json({ message: "Lead already marked as approved." });
    }

    await db("stir_outreach_dashboard").insert({
      user_id,
      username,
      business_email,
      poc,
      poc_email_address,
    });

    res.status(201).json({ message: "Lead marked as approved." });
  } catch (error) {
    console.error("Error inserting approved lead:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /mark-irrelevant
router.post("/mark-irrelevant", async (req, res) => {
  const { user_id, username, business_email } = req.body;

  if (!user_id || !username || !business_email) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const existing = await db("influencer_outreach_irrelevant_leads")
      .where({ business_email })
      .first();

    if (existing) {
      return res.status(409).json({ message: "Lead already marked as irrelevant." });
    }

    await db("influencer_outreach_irrelevant_leads").insert({
      user_id,
      username,
      business_email,
    });

    res.status(201).json({ message: "Lead marked as irrelevant." });
  } catch (error) {
    console.error("Error inserting irrelevant lead:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// GET /irrelevant-leads
router.get("/irrelevant-leads", async (req, res) => {
  try {
    const irrelevantLeads = await db("influencer_outreach_irrelevant_leads")
      .select("user_id", "username", "business_email");

    res.status(200).json({ irrelevantLeads });
  } catch (error) {
    console.error("Error fetching irrelevant leads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.delete("/irrelevant-leads", async (req, res) => {
  try {
    const { business_email } = req.body;
console.log({business_email})
    if (!business_email) {
      return res.status(400).json({ error: "business_email is required" });
    }

    const deletedCount = await db("influencer_outreach_irrelevant_leads")
      .where("business_email", business_email)
      .del();
console.log({deletedCount})
    if (deletedCount === 0) {
      return res.status(404).json({ message: "No lead found with that email" });
    }

    res.status(200).json({ message: "Irrelevant lead deleted successfully" });
  } catch (error) {
    console.error("Error deleting irrelevant lead:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
