// routes/dashboard.js
import express from "express";
import { db } from "../db/db.js";
import { 
  format, 
  parseISO, 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  addDays,
  isSameDay,
  isWithinInterval,
  addMonths,
  subMonths
} from "date-fns";

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics based on time filters
 */
router.get("/stats", async (req, res) => {
  try {
    const {
      timeRange = "last7days",
      dateFrom,
      dateTo,
      poc = "all"
    } = req.query;

    // Calculate date range based on timeRange
    let from, to;
    const today = new Date();

    if (dateFrom && dateTo && timeRange === "custom") {
      from = startOfDay(parseISO(dateFrom));
      to = endOfDay(parseISO(dateTo));
    } else {
      switch (timeRange) {
        case "today":
          from = startOfDay(today);
          to = endOfDay(today);
          break;
        case "yesterday":
          from = startOfDay(subDays(today, 1));
          to = endOfDay(subDays(today, 1));
          break;
        case "last7days":
          from = startOfDay(subDays(today, 6));
          to = endOfDay(today);
          break;
        case "last30days":
          from = startOfDay(subDays(today, 29));
          to = endOfDay(today);
          break;
        case "thisMonth":
          from = startOfDay(startOfMonth(today));
          to = endOfDay(today);
          break;
        case "lastMonth":
          from = startOfDay(startOfMonth(subMonths(today, 1)));
          to = endOfDay(endOfMonth(subMonths(today, 1)));
          break;
        case "last3months":
          from = startOfDay(subMonths(today, 3));
          to = endOfDay(today);
          break;
        case "last6months":
          from = startOfDay(subMonths(today, 6));
          to = endOfDay(today);
          break;
        case "lastYear":
          from = startOfDay(subMonths(today, 12));
          to = endOfDay(today);
          break;
        default:
          from = startOfDay(subDays(today, 6));
          to = endOfDay(today);
      }
    }

    const fromFormatted = format(from, 'yyyy-MM-dd');
    const toFormatted = format(to, 'yyyy-MM-dd');

    // Base query - get all users within the date range
    // We use created_at for initial filtering to ensure we get all relevant users
    let query = db("stir_outreach_dashboard")
      .whereBetween(db.raw('DATE(created_at)'), [fromFormatted, toFormatted]);

    // Apply POC filter if specified
    if (poc !== "all") {
      query = query.where("poc", poc);
    }

    const users = await query;
    
    // If no users found, return empty data with proper structure
    if (users.length === 0) {
      return res.json({
        dateRange: {
          from: fromFormatted,
          to: toFormatted,
        },
        stats: {
          totalEmails: 0,
          totalReplies: 0,
          totalCalendlyClicks: 0,
          totalOnboardingClicks: 0,
          totalVideoCallsScheduled: 0,
          totalOnboardingsCompleted: 0,
          totalUnsubscribes: 0,
          replyRate: 0,
          calendlyClickRate: 0,
          onboardingClickRate: 0
        },
        chartData: eachDayOfInterval({ start: from, end: to }).map(date => ({
          date: format(date, 'yyyy-MM-dd'),
          emailsSent: 0,
          repliesReceived: 0,
          calendlyClicks: 0,
          onboardingClicks: 0
        })),
        recentActivity: [],
        status: "success",
      });
    }

    // Calculate statistics
    const totalEmails = users.filter(user => user.first_email_status === 'sent').length;
    const totalReplies = users.filter(user => user.replied).length;
    const totalCalendlyClicks = users.filter(user => user.calendly_link_clicked).length;
    const totalOnboardingClicks = users.filter(user => user.onboarding_link_clicked).length;
    const totalVideoCallsScheduled = users.filter(user => user.video_call_status === 'scheduled').length;
    const totalOnboardingsCompleted = users.filter(user => user.onboarding_status === 'completed').length;
    const totalUnsubscribes = users.filter(user => user.unsubscribed).length;

    // Calculate reply rate
    const replyRate = totalEmails > 0 ? (totalReplies / totalEmails) * 100 : 0;
    
    // Calculate calendly click rate
    const calendlyClickRate = totalEmails > 0 ? (totalCalendlyClicks / totalEmails) * 100 : 0;
    
    // Calculate onboarding click rate
    const onboardingClickRate = totalEmails > 0 ? (totalOnboardingClicks / totalEmails) * 100 : 0;

    // Generate chart data for the specified time range
    const days = eachDayOfInterval({ start: from, end: to });
    
    const chartData = days.map(day => {
      const dayFormatted = format(day, 'yyyy-MM-dd');
      
      // Count emails sent on this day
      const emailsSent = users.filter(user => 
        user.first_email_date && format(new Date(user.first_email_date), 'yyyy-MM-dd') === dayFormatted && 
        user.first_email_status === 'sent'
      ).length;
      
      // Count replies received on this day
      const repliesReceived = users.filter(user => 
        user.email_reply_date && format(new Date(user.email_reply_date), 'yyyy-MM-dd') === dayFormatted
      ).length;
      
      // Count calendly clicks on this day
      const calendlyClicks = users.filter(user => 
        user.calendly_click_date && format(new Date(user.calendly_click_date), 'yyyy-MM-dd') === dayFormatted
      ).length;
      
      // Count onboarding clicks on this day
      const onboardingClicks = users.filter(user => 
        user.onboarding_click_date && format(new Date(user.onboarding_click_date), 'yyyy-MM-dd') === dayFormatted
      ).length;

      return {
        date: dayFormatted,
        emailsSent,
        repliesReceived,
        calendlyClicks,
        onboardingClicks
      };
    });

    // For longer time ranges, aggregate data by week or month
    let aggregatedChartData = chartData;
    
    // Aggregate only if the time range is more than 30 days
    if (days.length > 30) {
      if (days.length > 90) {
        // For very long ranges, aggregate by month
        const monthlyData = {};
        
        chartData.forEach(day => {
          const month = day.date.substring(0, 7); // Get YYYY-MM
          if (!monthlyData[month]) {
            monthlyData[month] = {
              date: month + "-01", // First day of month
              emailsSent: 0,
              repliesReceived: 0,
              calendlyClicks: 0,
              onboardingClicks: 0
            };
          }
          
          monthlyData[month].emailsSent += day.emailsSent;
          monthlyData[month].repliesReceived += day.repliesReceived;
          monthlyData[month].calendlyClicks += day.calendlyClicks;
          monthlyData[month].onboardingClicks += day.onboardingClicks;
        });
        
        aggregatedChartData = Object.values(monthlyData).sort((a, b) => a.date.localeCompare(b.date));
      } else {
        // For medium ranges, aggregate by week
        const weeklyData = {};
        
        chartData.forEach(day => {
          const date = new Date(day.date);
          const weekStart = format(startOfDay(date), 'yyyy-MM-dd');
          
          if (!weeklyData[weekStart]) {
            weeklyData[weekStart] = {
              date: weekStart,
              emailsSent: 0,
              repliesReceived: 0,
              calendlyClicks: 0,
              onboardingClicks: 0
            };
          }
          
          weeklyData[weekStart].emailsSent += day.emailsSent;
          weeklyData[weekStart].repliesReceived += day.repliesReceived;
          weeklyData[weekStart].calendlyClicks += day.calendlyClicks;
          weeklyData[weekStart].onboardingClicks += day.onboardingClicks;
        });
        
        aggregatedChartData = Object.values(weeklyData).sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    // Recent activity
    const recentActivity = users
      .filter(user => {
        // Include users with any recent activity
        return user.first_email_date || 
               user.calendly_click_date || 
               user.onboarding_click_date || 
               user.email_reply_date || 
               user.video_call_date;
      })
      .map(user => {
        // Determine most recent activity
        const activities = [
          { type: 'email_sent', date: user.first_email_date, time: user.first_email_time },
          { type: 'calendly_clicked', date: user.calendly_click_date, time: user.calendly_click_time },
          { type: 'onboarding_clicked', date: user.onboarding_click_date, time: user.onboarding_click_time },
          { type: 'reply_received', date: user.email_reply_date, time: user.email_reply_time },
          { type: 'video_call_scheduled', date: user.video_call_date, time: null }
        ]
        .filter(activity => activity.date) // Filter out activities without dates
        .sort((a, b) => {
          // Sort by date in descending order (most recent first)
          const dateA = new Date(`${a.date}T${a.time || '00:00:00'}`);
          const dateB = new Date(`${b.date}T${b.time || '00:00:00'}`);
          return dateB - dateA;
        });

        const mostRecentActivity = activities[0]; // Get most recent activity
        
        if (!mostRecentActivity) return null;

        return {
          id: user.id,
          userId: user.user_id,
          username: user.username,
          email: user.business_email,
          poc: user.poc,
          activityType: mostRecentActivity.type,
          activityDate: mostRecentActivity.date,
          activityTime: mostRecentActivity.time,
          timestamp: new Date(`${mostRecentActivity.date}T${mostRecentActivity.time || '00:00:00'}`)
        };
      })
      .filter(activity => activity !== null)
      .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp in descending order
      .slice(0, 10); // Limit to 10 recent activities

    // Return all the calculated statistics and data
    res.json({
      dateRange: {
        from: fromFormatted,
        to: toFormatted,
      },
      stats: {
        totalEmails,
        totalReplies,
        totalCalendlyClicks,
        totalOnboardingClicks,
        totalVideoCallsScheduled,
        totalOnboardingsCompleted,
        totalUnsubscribes,
        replyRate: parseFloat(replyRate.toFixed(2)),
        calendlyClickRate: parseFloat(calendlyClickRate.toFixed(2)),
        onboardingClickRate: parseFloat(onboardingClickRate.toFixed(2))
      },
      chartData: aggregatedChartData,
      recentActivity,
      status: "success",
    });
  } catch (error) {
    console.error("Error processing dashboard stats request:", error);
    res.status(500).json({ error: "Failed to process dashboard stats request" });
  }
});

/**
 * GET /api/dashboard/pocs
 * Get list of POCs for filter dropdown
 */
router.get("/pocs", async (req, res) => {
  try {
    const results = await db("stir_outreach_dashboard")
      .distinct("poc")
      .whereNotNull("poc")
      .orderBy("poc");
    
    const pocs = results.map(item => item.poc);
    res.json(pocs);
  } catch (error) {
    console.error("Error fetching POCs:", error);
    res.status(500).json({ error: "Failed to fetch POCs" });
  }
});

/**
 * GET /api/dashboard
 * Main dashboard endpoint for backwards compatibility
 */
router.get("/", async (req, res) => {
  try {
    // Redirect to the stats endpoint
    const {
      timeRange = "last7days",
      dateFrom,
      dateTo,
      poc = "all",
    } = req.query;

    let redirectUrl = `/api/dashboard/stats?timeRange=${timeRange}&poc=${poc}`;
    
    if (timeRange === "custom" && dateFrom && dateTo) {
      redirectUrl += `&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    }
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error processing dashboard request:", error);
    res.status(500).json({ error: "Failed to process dashboard request" });
  }
});

export default router;