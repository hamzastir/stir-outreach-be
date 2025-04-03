// routes/dashboard.js
import express from "express";
import { db } from "../db/db.js";
import { 
  format,  
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  eachHourOfInterval,
  isWithinInterval,
  subMonths,
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
      poc = "all",
      granularity
    } = req.query;
    
    // Get all users data
    let query = db("stir_outreach_dashboard");
    
    // Apply POC filter if specified
    if (poc !== "all") {
      query = query.where("poc", poc);
    }
    
    const users = await query;
    
    // If no users found, return empty result
    if (users.length === 0) {
      return res.json({
        dateRange: { from: "", to: "" },
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
        chartData: [],
        recentActivity: [],
        status: "success"
      });
    }
    
    // Determine date range based on timeRange
    let fromDate, toDate;
    const now = new Date();
    
    switch (timeRange) {
      case "today":
        fromDate = startOfDay(now);
        toDate = endOfDay(now);
        break;
        
      case "yesterday":
        fromDate = startOfDay(subDays(now, 1));
        toDate = endOfDay(subDays(now, 1));
        break;
        
      case "last7days":
        fromDate = startOfDay(subDays(now, 6));
        toDate = endOfDay(now);
        break;
        
      case "last30days":
        fromDate = startOfDay(subDays(now, 29));
        toDate = endOfDay(now);
        break;
        
      case "thisMonth":
        fromDate = startOfMonth(now);
        toDate = endOfDay(now);
        break;
        
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        fromDate = startOfMonth(lastMonth);
        toDate = endOfMonth(lastMonth);
        break;
        
      case "last3months":
        fromDate = startOfDay(subMonths(now, 3));
        toDate = endOfDay(now);
        break;
        
      case "last6months":
        fromDate = startOfDay(subMonths(now, 6));
        toDate = endOfDay(now);
        break;
        
      case "lastYear":
        fromDate = startOfDay(subMonths(now, 12));
        toDate = endOfDay(now);
        break;
        
      case "custom":
        if (dateFrom && dateTo) {
          fromDate = startOfDay(new Date(dateFrom));
          toDate = endOfDay(new Date(dateTo));
        } else {
          fromDate = startOfDay(subDays(now, 6));
          toDate = endOfDay(now);
        }
        break;
        
      default:
        fromDate = startOfDay(subDays(now, 6));
        toDate = endOfDay(now);
    }
    
    // Helper function to parse date and time strings
   // Helper function to parse date and time strings
const parseDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  
  try {
    let date;
    
    // Check if dateStr is already a Date object
    if (dateStr instanceof Date) {
      date = dateStr;
    } 
    // Check if it's a string with the 'T' character (ISO format)
    else if (typeof dateStr === 'string' && dateStr.includes('T')) {
      date = new Date(dateStr);
    } 
    // Regular date string (YYYY-MM-DD)
    else if (typeof dateStr === 'string') {
      // Split date string into components
      const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      
      date = new Date(year, month - 1, day);
    }
    // If it's neither a Date nor a string, return null
    else {
      return null;
    }
    
    // Add time if provided
    if (timeStr && typeof timeStr === 'string') {
      const timeParts = timeStr.split(':');
      if (timeParts.length >= 2) {
        const hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
        const second = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
        
        if (!isNaN(hour) && !isNaN(minute) && !isNaN(second)) {
          date.setHours(hour, minute, second);
        }
      }
    }
    
    return date;
  } catch (err) {
    console.warn(`Error parsing date: ${dateStr} ${timeStr}`, err);
    return null;
  }
};
    
    // Initialize statistics
    const stats = {
      totalEmails: 0,
      totalReplies: 0,
      totalCalendlyClicks: 0,
      totalOnboardingClicks: 0,
      totalVideoCallsScheduled: 0,
      totalOnboardingsCompleted: 0,
      totalUnsubscribes: 0
    };
    
    // Initialize recent activity array
    const recentActivity = [];
    
    // Use hourly granularity for today and yesterday
    if ((timeRange === 'today' || timeRange === 'yesterday') && granularity === 'hourly') {
      // Generate hourly intervals
      const chartInterval = eachHourOfInterval({ start: fromDate, end: toDate });
      
      // Initialize hourly chart data with all 24 hours
      const chartData = chartInterval.map(hour => {
        return {
          date: format(hour, "yyyy-MM-dd'T'HH:00:00"),
          hour: format(hour, "HH:00"),
          emailsSent: 0,
          repliesReceived: 0,
          calendlyClicks: 0,
          onboardingClicks: 0,
          videoCallsScheduled: 0,
          onboardingsCompleted: 0
        };
      });
      
      // Process each user's data
      users.forEach(user => {
        // Process email sent
        if (user.first_email_date && user.first_email_status === 'sent') {
          const emailDate = parseDateTime(user.first_email_date, user.first_email_time);
          
          if (emailDate && isWithinInterval(emailDate, { start: fromDate, end: toDate })) {
            stats.totalEmails++;
            
            // Add to hourly chart data
            const hour = emailDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].emailsSent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: user.id,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'email_sent',
              activityDate: user.first_email_date,
              activityTime: user.first_email_time,
              timestamp: emailDate
            });
          }
        }
        
        // Process replies
        if (user.email_reply_date && user.replied) {
          const replyDate = parseDateTime(user.email_reply_date, user.email_reply_time);
          
          if (replyDate && isWithinInterval(replyDate, { start: fromDate, end: toDate })) {
            stats.totalReplies++;
            
            // Add to hourly chart data
            const hour = replyDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].repliesReceived++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `reply_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'reply_received',
              activityDate: user.email_reply_date,
              activityTime: user.email_reply_time,
              timestamp: replyDate
            });
          }
        }
        
        // Process calendly clicks
        if (user.calendly_click_date && user.calendly_link_clicked) {
          const clickDate = parseDateTime(user.calendly_click_date, user.calendly_click_time);
          
          if (clickDate && isWithinInterval(clickDate, { start: fromDate, end: toDate })) {
            stats.totalCalendlyClicks++;
            
            // Add to hourly chart data
            const hour = clickDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].calendlyClicks++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `calendly_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_clicked',
              activityDate: user.calendly_click_date,
              activityTime: user.calendly_click_time,
              timestamp: clickDate
            });
          }
        }
        
        // Process onboarding clicks
        if (user.onboarding_click_date && user.onboarding_link_clicked) {
          const clickDate = parseDateTime(user.onboarding_click_date, user.onboarding_click_time);
          
          if (clickDate && isWithinInterval(clickDate, { start: fromDate, end: toDate })) {
            stats.totalOnboardingClicks++;
            
            // Add to hourly chart data
            const hour = clickDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].onboardingClicks++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_clicked',
              activityDate: user.onboarding_click_date,
              activityTime: user.onboarding_click_time,
              timestamp: clickDate
            });
          }
        }
        // Process completed onboardings
if (user.onboarding_date && user.onboarding_status === 'completed') {
  const onboardingDate = parseDateTime(user.onboarding_date, null);
  
  if (onboardingDate && isWithinInterval(onboardingDate, { start: fromDate, end: toDate })) {
    stats.totalOnboardingsCompleted++;
    
    // For hourly data
    const hour = onboardingDate.getHours();
    const hourIndex = chartData.findIndex(data => {
      const dataHour = new Date(data.date).getHours();
      return dataHour === hour;
    });
    
    if (hourIndex !== -1) {
      chartData[hourIndex].onboardingsCompleted++;
    }
    
    // OR for daily data
    // Format the date to yyyy-MM-dd for comparison
    const formattedDate = format(onboardingDate, 'yyyy-MM-dd');
    
    // Find the matching day in chartData
    const dayIndex = chartData.findIndex(day => day.date === formattedDate);
    
    if (dayIndex !== -1) {
      chartData[dayIndex].onboardingsCompleted++;
    }
    
    // Add to recent activity
    recentActivity.push({
      id: `onboarding_complete_${user.id}`,
      userId: user.user_id,
      username: user.username || 'Unknown',
      email: user.business_email || 'No email',
      poc: user.poc || 'Unknown POC',
      activityType: 'onboarding_completed',
      activityDate: user.onboarding_date,
      activityTime: null,
      timestamp: onboardingDate
    });
  }
}
        // Process video calls
        if (user.video_call_date && user.video_call_status === 'scheduled') {
          const callDate = parseDateTime(user.video_call_date, null);
          
          if (callDate && isWithinInterval(callDate, { start: fromDate, end: toDate })) {
            stats.totalVideoCallsScheduled++;
            
            // Add to hourly chart data
            const hour = callDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].videoCallsScheduled++;
            } else {
              // If no hour is specified, add to first hour of the day
              chartData[0].videoCallsScheduled++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `video_call_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'video_call_scheduled',
              activityDate: user.video_call_date,
              activityTime: null,
              timestamp: callDate
            });
          }
        }
        
        // Count unsubscribes
        if (user.unsubscribed && user.unsubscribe_date) {
          const unsubDate = parseDateTime(user.unsubscribe_date, null);
          
          if (unsubDate && isWithinInterval(unsubDate, { start: fromDate, end: toDate })) {
            stats.totalUnsubscribes++;
          }
        }
      });
      
      // Sort recent activity by timestamp (newest first)
      recentActivity.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return b.timestamp - a.timestamp;
      });
      
      // Calculate rates
      stats.replyRate = stats.totalEmails > 0 ? (stats.totalReplies / stats.totalEmails) * 100 : 0;
      stats.calendlyClickRate = stats.totalEmails > 0 ? (stats.totalCalendlyClicks / stats.totalEmails) * 100 : 0;
      stats.onboardingClickRate = stats.totalEmails > 0 ? (stats.totalOnboardingClicks / stats.totalEmails) * 100 : 0;
      
      // Return the hourly data
      return res.json({
        dateRange: {
          from: format(fromDate, "yyyy-MM-dd"),
          to: format(toDate, "yyyy-MM-dd")
        },
        stats,
        chartData,
        recentActivity: recentActivity.slice(0, 20),
        status: "success"
      });
    } else {
      // Generate daily intervals for chart data
      const chartInterval = eachDayOfInterval({ start: fromDate, end: toDate });
      
      // Initialize daily chart data
      const chartData = chartInterval.map(day => {
        return {
          date: format(day, "yyyy-MM-dd"),
          emailsSent: 0,
          repliesReceived: 0,
          calendlyClicks: 0,
          onboardingClicks: 0,
          videoCallsScheduled: 0,
          onboardingsCompleted: 0
        };
      });
      
      // Process each user's data
      users.forEach(user => {
        // Process email sent
        if (user.first_email_date && user.first_email_status === 'sent') {
          const emailDate = parseDateTime(user.first_email_date, user.first_email_time);
          
          if (emailDate && isWithinInterval(emailDate, { start: fromDate, end: toDate })) {
            stats.totalEmails++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(emailDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].emailsSent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: user.id,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'email_sent',
              activityDate: user.first_email_date,
              activityTime: user.first_email_time,
              timestamp: emailDate
            });
          }
        }
        
        // Process replies
        if (user.email_reply_date && user.replied) {
          const replyDate = parseDateTime(user.email_reply_date, user.email_reply_time);
          
          if (replyDate && isWithinInterval(replyDate, { start: fromDate, end: toDate })) {
            stats.totalReplies++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(replyDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].repliesReceived++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `reply_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'reply_received',
              activityDate: user.email_reply_date,
              activityTime: user.email_reply_time,
              timestamp: replyDate
            });
          }
        }
        
        // Process calendly clicks
        if (user.calendly_click_date && user.calendly_link_clicked) {
          const clickDate = parseDateTime(user.calendly_click_date, user.calendly_click_time);
          
          if (clickDate && isWithinInterval(clickDate, { start: fromDate, end: toDate })) {
            stats.totalCalendlyClicks++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(clickDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].calendlyClicks++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `calendly_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_clicked',
              activityDate: user.calendly_click_date,
              activityTime: user.calendly_click_time,
              timestamp: clickDate
            });
          }
        }
        
        // Process onboarding clicks
        if (user.onboarding_click_date && user.onboarding_link_clicked) {
          const clickDate = parseDateTime(user.onboarding_click_date, user.onboarding_click_time);
          
          if (clickDate && isWithinInterval(clickDate, { start: fromDate, end: toDate })) {
            stats.totalOnboardingClicks++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(clickDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].onboardingClicks++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_clicked',
              activityDate: user.onboarding_click_date,
              activityTime: user.onboarding_click_time,
              timestamp: clickDate
            });
          }
        }
        
        // Process video calls
        if (user.video_call_date && user.video_call_status === 'scheduled') {
          const callDate = parseDateTime(user.video_call_date, null);
          
          if (callDate && isWithinInterval(callDate, { start: fromDate, end: toDate })) {
            stats.totalVideoCallsScheduled++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(callDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].videoCallsScheduled++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `video_call_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'video_call_scheduled',
              activityDate: user.video_call_date,
              activityTime: null,
              timestamp: callDate
            });
          }
        }
        
        // Count unsubscribes
        if (user.unsubscribed && user.unsubscribe_date) {
          const unsubDate = parseDateTime(user.unsubscribe_date, null);
          
          if (unsubDate && isWithinInterval(unsubDate, { start: fromDate, end: toDate })) {
            stats.totalUnsubscribes++;
          }
        }
      });
      
      // Sort recent activity by timestamp (newest first)
      recentActivity.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return b.timestamp - a.timestamp;
      });
      
      // Calculate rates
      stats.replyRate = stats.totalEmails > 0 ? (stats.totalReplies / stats.totalEmails) * 100 : 0;
      stats.calendlyClickRate = stats.totalEmails > 0 ? (stats.totalCalendlyClicks / stats.totalEmails) * 100 : 0;
      stats.onboardingClickRate = stats.totalEmails > 0 ? (stats.totalOnboardingClicks / stats.totalEmails) * 100 : 0;
      
      // Return the daily data
      return res.json({
        dateRange: {
          from: format(fromDate, "yyyy-MM-dd"),
          to: format(toDate, "yyyy-MM-dd")
        },
        stats,
        chartData,
        recentActivity: recentActivity.slice(0, 20),
        status: "success"
      });
    }
    
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ 
      error: "Failed to fetch dashboard stats",
      details: error.message,
      stack: error.stack
    });
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
router.get("/recent-activity", async (req, res) => {
  try {
    // Get all users data
    const users = await db("stir_outreach_dashboard");
    
    // If no users found, return empty array
    if (users.length === 0) {
      return res.json({
        activities: [],
        status: "success"
      });
    }
    
    // Collect all activities
    let allActivities = [];
    
    users.forEach(user => {
      try {
        // Add email sent activity
        if (user.first_email_date && user.first_email_status === 'sent') {
          allActivities.push({
            id: `email_${user.id}`,
            userId: user.user_id,
            username: user.username || 'Unknown',
            name: user.name || user.username || 'Unknown',
            email: user.business_email || 'No email',
            poc: user.poc || 'Unknown POC',
            activityType: 'email_sent',
            activityDate: user.first_email_date,
            activityTime: user.first_email_time,
            dateString: `${user.first_email_date} ${user.first_email_time || '00:00:00'}`
          });
        }
        
        // Add reply received activity
        if (user.email_reply_date && user.replied) {
          allActivities.push({
            id: `reply_${user.id}`,
            userId: user.user_id,
            username: user.username || 'Unknown',
            name: user.name || user.username || 'Unknown',
            email: user.business_email || 'No email',
            poc: user.poc || 'Unknown POC',
            activityType: 'reply_received',
            activityDate: user.email_reply_date,
            activityTime: user.email_reply_time,
            dateString: `${user.email_reply_date} ${user.email_reply_time || '00:00:00'}`
          });
        }
        
        // Add calendly click activity
        if (user.calendly_click_date && user.calendly_link_clicked) {
          allActivities.push({
            id: `calendly_${user.id}`,
            userId: user.user_id,
            username: user.username || 'Unknown',
            name: user.name || user.username || 'Unknown',
            email: user.business_email || 'No email',
            poc: user.poc || 'Unknown POC',
            activityType: 'calendly_clicked',
            activityDate: user.calendly_click_date,
            activityTime: user.calendly_click_time,
            dateString: `${user.calendly_click_date} ${user.calendly_click_time || '00:00:00'}`
          });
        }
        
        // Add onboarding click activity
        if (user.onboarding_click_date && user.onboarding_link_clicked) {
          allActivities.push({
            id: `onboarding_${user.id}`,
            userId: user.user_id,
            username: user.username || 'Unknown',
            name: user.name || user.username || 'Unknown',
            email: user.business_email || 'No email',
            poc: user.poc || 'Unknown POC',
            activityType: 'onboarding_clicked',
            activityDate: user.onboarding_click_date,
            activityTime: user.onboarding_click_time,
            dateString: `${user.onboarding_click_date} ${user.onboarding_click_time || '00:00:00'}`
          });
        }
        
        // Add video call scheduled activity
        if (user.video_call_date && user.video_call_status === 'scheduled') {
          allActivities.push({
            id: `video_call_${user.id}`,
            userId: user.user_id,
            username: user.username || 'Unknown',
            name: user.name || user.username || 'Unknown',
            email: user.business_email || 'No email',
            poc: user.poc || 'Unknown POC',
            activityType: 'video_call_scheduled',
            activityDate: user.video_call_date,
            activityTime: null,
            dateString: `${user.video_call_date} 00:00:00`
          });
        }
      } catch (err) {
        console.warn(`Error processing user ${user.id}:`, err);
        // Continue with the next user
      }
    });
    
    // Sort by date (most recent first)
    // Using string comparison for simplicity and to avoid date parsing issues
    allActivities.sort((a, b) => {
      if (!a.dateString && !b.dateString) return 0;
      if (!a.dateString) return 1;
      if (!b.dateString) return -1;
      return b.dateString.localeCompare(a.dateString);
    });
    
    // Get the most recent activities (limit to 100 to avoid too much data)
    const recentActivities = allActivities.slice(0, 100);
    
    // Return the results
    res.json({
      activities: recentActivities,
      total: allActivities.length,
      status: "success"
    });
    
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({ 
      error: "Failed to fetch recent activity",
      details: error.message
    });
  }
});

export default router;