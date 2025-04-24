import express from "express";
import { db } from "../db/db.js";

const router = express.Router();

// GET endpoint to fetch all data from cinando_staff table with enhanced filtering
router.get("/staff", async (req, res) => {
    try {
        // Add pagination parameters with defaults
        const page = parseInt(req.query.page) || 1;
        // Allow explicit per-page limit with fixed options
        let limit = parseInt(req.query.limit) || 50;
        // Ensure limit is one of the allowed values (25, 50, 100)
        if (![25, 50, 100].includes(limit)) {
            limit = 50; // Default to 50 if an invalid value is provided
        }
        const offset = (page - 1) * limit;
        
        // Allow selective field fetching
        const fields = req.query.fields ? req.query.fields.split(',') : ['*'];
        
        // Add sorting option
        const sortBy = req.query.sortBy || 'id';
        const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
        
        // Advanced filtering options
        let query = db('cinando_staff');
        
        // Filter by role
        if (req.query.role) {
            query = query.whereILike('role', `%${req.query.role}%`);
        }
        
        // Filter by company name
        if (req.query.company) {
            query = query.whereILike('company_name', `%${req.query.company}%`);
        }
        
        // Filter by location (from company_location)
        if (req.query.location) {
            query = query.whereILike('company_location', `%${req.query.location}%`);
        }

        // Filter by timezone
        if (req.query.timezone) {
            query = query.whereILike('timezone', `%${req.query.timezone}%`);
        }
        
        // Filter by has_email (has email contact info)
        if (req.query.has_email === 'true') {
            query = query.whereNot('email', '').whereNotNull('email');
        }
        
        // New: Filter by specific email
        if (req.query.email) {
            query = query.whereILike('email', `%${req.query.email}%`);
        }
        
        // Filter by has_phone (has phone contact info)
        if (req.query.has_phone === 'true') {
            query = query.where(function() {
                this.whereNot('phone', '').orWhereNot('mobile', '');
            });
        }
        
        // New: Filter by specific phone/mobile number
        if (req.query.phone) {
            query = query.where(function() {
                this.whereILike('phone', `%${req.query.phone}%`)
                    .orWhereILike('mobile', `%${req.query.phone}%`);
            });
        }
        
        // Filter by has_social (has any social links)
        if (req.query.has_social === 'true') {
            query = query.whereRaw("JSON_EXTRACT(social_links, '$.imdb') != '' OR JSON_EXTRACT(social_links, '$.twitter') != '' OR JSON_EXTRACT(social_links, '$.facebook') != '' OR JSON_EXTRACT(social_links, '$.linkedin') != '' OR JSON_EXTRACT(social_links, '$.instagram') != ''");
        }
        
        // Execute count query with the same filters but without pagination
        const countQuery = query.clone();
        const [{ count }] = await countQuery.count('* as count');
        
        // Main data query with pagination, field selection and sorting
        const staffData = await query
          .select(fields)
          .orderBy(sortBy, sortOrder)
          .limit(limit)
          .offset(offset);
        
        res.status(200).json({
          success: true,
          data: staffData,
          pagination: {
            total: parseInt(count),
            page,
            limit,
            pages: Math.ceil(parseInt(count) / limit)
          }
        });
      } catch (error) {
        console.error("Error fetching cinando staff:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch cinando staff",
          error: error.message
        });
      }
});

// GET endpoint to fetch staff profile with company data
router.get("/staff/:id", async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get staff profile
        const staffMember = await db('cinando_staff')
            .where('id', id)
            .first();
            
        if (!staffMember) {
            return res.status(404).json({
                success: false,
                message: "Staff member not found"
            });
        }
        
        // Get company data if available
        let companyData = null;
        if (staffMember.company_id) {
            companyData = await db('cinando_companies')
                .where('id', staffMember.company_id)
                .first();
        }
        
        // Format response to highlight contact info and social links
        const contactInfo = {
            email: staffMember.email || null,
            phone: staffMember.phone || null,
            mobile: staffMember.mobile || null,
            timezone: staffMember.timezone || null
        };
        
        res.status(200).json({
            success: true,
            data: {
                id: staffMember.id,
                name: staffMember.name,
                role: staffMember.role,
                sub_role: staffMember.sub_role,
                profile_link: staffMember.profile_link,
                image_url: staffMember.image_url,
                contactInfo,
                socialLinks: staffMember.social_links,
                about: staffMember.about,
                mainCredits: staffMember.main_credits,
                companyInfo: {
                    id: staffMember.company_id,
                    name: staffMember.company_name,
                    location: staffMember.company_location,
                    contact: staffMember.company_contact,
                    link: staffMember.company_link,
                    roles: staffMember.company_roles
                },
                companyDetails: companyData
            }
        });
    } catch (error) {
        console.error("Error fetching staff profile:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch staff profile",
            error: error.message
        });
    }
});

// GET endpoint to search for staff with query parameter
router.get("/search/staff", async (req, res) => {
    try {
        const { query } = req.query;
        // Fix pagination
        const page = parseInt(req.query.page) || 1;
        // Allow explicit per-page limit with fixed options
        let limit = parseInt(req.query.limit) || 50;
        // Ensure limit is one of the allowed values (25, 50, 100)
        if (![25, 50, 100].includes(limit)) {
            limit = 50; // Default to 50 if an invalid value is provided
        }
        const offset = (page - 1) * limit;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Search query is required"
            });
        }
        
        // Build search query
        let searchQuery = db('cinando_staff')
            .where(function() {
                // Search in name
                this.whereILike('name', `%${query}%`)
                // Search in company name
                .orWhereILike('company_name', `%${query}%`)
                // Search in role
                .orWhereILike('role', `%${query}%`)
                // Search in sub_role
                .orWhereILike('sub_role', `%${query}%`)
                // Search in company location
                .orWhereILike('company_location', `%${query}%`)
                // Search in about
                .orWhereILike('about', `%${query}%`)
                // Search in main_credits
                .orWhereILike('main_credits', `%${query}%`)
                // Search in email
                .orWhereILike('email', `%${query}%`)
                // Search in phone/mobile
                .orWhereILike('phone', `%${query}%`)
                .orWhereILike('mobile', `%${query}%`);
            });
            
        // Get total count
        const countQuery = searchQuery.clone();
        const [{ count }] = await countQuery.count('* as count');
        
        // Execute main query with pagination
        const results = await searchQuery
            .select('*')
            .limit(limit)
            .offset(offset);
            
        res.status(200).json({
            success: true,
            data: results,
            pagination: {
                total: parseInt(count),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(parseInt(count) / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error searching staff:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search staff",
            error: error.message
        });
    }
});

// GET endpoint to fetch staff by company ID
// GET endpoint to fetch staff by company ID - fixed version
router.get("/company/:id/staff", async (req, res) => {
    try {
        const { id } = req.params;
        // Fix pagination
        const page = parseInt(req.query.page) || 1;
        // Allow explicit per-page limit with fixed options
        let limit = parseInt(req.query.limit) || 50;
        // Ensure limit is one of the allowed values (25, 50, 100)
        if (![25, 50, 100].includes(limit)) {
            limit = 50; // Default to 50 if an invalid value is provided
        }
        const offset = (page - 1) * limit;
        
        // Check if company exists
        const company = await db('cinando_companies')
            .where('id', id)
            .first();
            
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }
        
        // Build query to get staff for this company - ensure we're explicitly matching the string value
        let staffQuery = db('cinando_staff')
            .where('company_id', id);
            
        // Add additional debugging logs
        console.log(`Fetching staff for company ID: ${id}`);
        
        // Apply additional filters if provided
        if (req.query.role) {
            staffQuery = staffQuery.whereILike('role', `%${req.query.role}%`);
        }
        
        if (req.query.has_email === 'true') {
            staffQuery = staffQuery.whereNot('email', '').whereNotNull('email');
        }
        
        if (req.query.has_phone === 'true') {
            staffQuery = staffQuery.where(function() {
                this.whereNot('phone', '').orWhereNot('mobile', '');
            });
        }
        
        // Log the SQL query for debugging
        const rawQuery = staffQuery.clone().toString();
        console.log("SQL Query:", rawQuery);
        
        // Get staff count for this company with applied filters
        const countQuery = staffQuery.clone();
        const [{ count }] = await countQuery.count('* as count');
        console.log(`Found ${count} staff members for company ID: ${id}`);
            
        // Get staff for this company with pagination and applied filters
        const staffMembers = await staffQuery
            .select('*')
            .orderBy('id', 'asc')
            .limit(limit)
            .offset(offset);
            
        // If no staff found, return an empty array but with successful response
        if (!staffMembers || staffMembers.length === 0) {
            console.log(`No staff members found for company ID: ${id}`);
            
            return res.status(200).json({
                success: true,
                data: {
                    company,
                    staff: []
                },
                pagination: {
                    total: 0,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: 0
                },
                message: "No staff members found for this company"
            });
        }
        
        // Log success
        console.log(`Successfully retrieved ${staffMembers.length} staff members for company ID: ${id}`);
        
        res.status(200).json({
            success: true,
            data: {
                company,
                staff: staffMembers
            },
            pagination: {
                total: parseInt(count),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(parseInt(count) / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching company staff:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch company staff",
            error: error.message
        });
    }
});

// GET endpoint to fetch company data by ID
router.get("/company/:id", async (req, res) => {
    try {
        const { id } = req.params;
        
        const company = await db('cinando_companies')
            .where('id', id)
            .first();
            
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }
        
        // Get staff count
        const [{ count }] = await db('cinando_staff')
            .where('company_id', id)
            .count();
            
        res.status(200).json({
            success: true,
            data: {
                ...company,
                staff_count: parseInt(count)
            }
        });
    } catch (error) {
        console.error("Error fetching company:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch company",
            error: error.message
        });
    }
});

// GET endpoint to fetch all data from cinando_companies table
router.get("/companies", async (req, res) => {
  try {
    // Fix pagination
    const page = parseInt(req.query.page) || 1;
    // Allow explicit per-page limit with fixed options
    let limit = parseInt(req.query.limit) || 50;
    // Ensure limit is one of the allowed values (25, 50, 100)
    if (![25, 50, 100].includes(limit)) {
        limit = 50; // Default to 50 if an invalid value is provided
    }
    const offset = (page - 1) * limit;
    
    // Allow selective field fetching
    const fields = req.query.fields ? req.query.fields.split(',') : ['*'];
    
    // Add sorting option
    const sortBy = req.query.sortBy || 'id';
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
    
    // Filter by name
    let query = db('cinando_companies');
    if (req.query.name) {
        query = query.whereILike('name', `%${req.query.name}%`);
    }
    
    // Filter by location
    if (req.query.location) {
        query = query.whereILike('address', `%${req.query.location}%`);
    }
    
    // Filter by activity
    if (req.query.activity) {
        query = query.whereRaw(`JSON_EXTRACT(activities, '$."${req.query.activity}"') IS NOT NULL`);
    }
    
    // Execute count query separately for better performance
    const countQuery = query.clone();
    const [{ count }] = await countQuery.count('* as count');
    
    // Main data query with pagination, field selection and sorting
    const companiesData = await query
      .select(fields)
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset(offset);
    
    res.status(200).json({
      success: true,
      data: companiesData,
      pagination: {
        total: parseInt(count),
        page,
        limit,
        pages: Math.ceil(parseInt(count) / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching cinando companies data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cinando companies data",
      error: error.message
    });
  }
});

// GET endpoint to fetch staff with contact information
router.get("/staff-with-contacts", async (req, res) => {
    try {
        // Fix pagination
        const page = parseInt(req.query.page) || 1;
        // Allow explicit per-page limit with fixed options
        let limit = parseInt(req.query.limit) || 50;
        // Ensure limit is one of the allowed values (25, 50, 100)
        if (![25, 50, 100].includes(limit)) {
            limit = 50; // Default to 50 if an invalid value is provided
        }
        const offset = (page - 1) * limit;
        
        // Build query to get staff with contact info
        let query = db('cinando_staff');
        
        // Filter by having email, phone, or both based on query params
        if (req.query.has_email === 'true' && req.query.has_phone === 'true') {
            // Staff with both email AND phone
            query = query.where(function() {
                this.whereNot('email', '').whereNotNull('email')
                .andWhere(function() {
                    this.whereNot('phone', '').orWhereNot('mobile', '');
                });
            });
        } else if (req.query.has_email === 'true') {
            // Staff with email only
            query = query.whereNot('email', '').whereNotNull('email');
        } else if (req.query.has_phone === 'true') {
            // Staff with phone only
            query = query.where(function() {
                this.whereNot('phone', '').orWhereNot('mobile', '');
            });
        } else {
            // Default: staff with any contact method
            query = query.where(function() {
                this.whereNot('email', '')
                .orWhereNot('phone', '')
                .orWhereNot('mobile', '');
            });
        }
        
        // Add filter for specific email
        if (req.query.email) {
            query = query.whereILike('email', `%${req.query.email}%`);
        }
        
        // Add filter for specific phone
        if (req.query.phone) {
            query = query.where(function() {
                this.whereILike('phone', `%${req.query.phone}%`)
                    .orWhereILike('mobile', `%${req.query.phone}%`);
            });
        }
            
        // Add filter by role if provided
        if (req.query.role) {
            query = query.whereILike('role', `%${req.query.role}%`);
        }
        
        // Get count
        const countQuery = query.clone();
        const [{ count }] = await countQuery.count('* as count');
        
        // Execute main query
        const staffWithContacts = await query
            .select('id', 'name', 'company_name', 'role', 'sub_role', 'email', 'phone', 'mobile', 'company_location', 'social_links')
            .orderBy('id', 'asc')
            .limit(limit)
            .offset(offset);
            
        res.status(200).json({
            success: true,
            data: staffWithContacts,
            pagination: {
                total: parseInt(count),
                page,
                limit,
                pages: Math.ceil(parseInt(count) / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching staff with contacts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch staff with contacts",
            error: error.message
        });
    }
});

// GET endpoint to fetch both cinando_staff and cinando_companies data
router.get("/all", async (req, res) => {
  try {
    const staffData = await db("cinando_staff").select("*");
    const companiesData = await db("cinando_companies").select("*");
    
    res.status(200).json({
      success: true,
      data: {
        staff: staffData,
        companies: companiesData
      },
      count: {
        staff: staffData.length,
        companies: companiesData.length
      }
    });
  } catch (error) {
    console.error("Error fetching cinando data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cinando data",
      error: error.message
    });
  }
});

// GET endpoint to filter companies based on staff email
router.get("/companies/by-email", async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email query parameter is required"
            });
        }

        // Fix pagination
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 50;
        if (![25, 50, 100].includes(limit)) {
            limit = 50;
        }
        const offset = (page - 1) * limit;

        // First find staff with matching email
        const staffWithEmail = await db('cinando_staff')
            .whereILike('email', `%${email}%`)
            .select('company_id')
            .whereNotNull('company_id')
            .distinct('company_id');

        if (staffWithEmail.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    pages: 0
                }
            });
        }

        // Get the company IDs
        const companyIds = staffWithEmail.map(item => item.company_id);

        // Build query to get companies
        let query = db('cinando_companies')
            .whereIn('id', companyIds);

        // Apply additional filters if provided
        if (req.query.name) {
            query = query.whereILike('name', `%${req.query.name}%`);
        }

        if (req.query.location) {
            query = query.whereILike('address', `%${req.query.location}%`);
        }

        // Execute count query
        const countQuery = query.clone();
        const [{ count }] = await countQuery.count('* as count');

        // Execute main query with pagination
        const companies = await query
            .select('*')
            .orderBy('name', 'asc')
            .limit(limit)
            .offset(offset);

        // For each company, get staff with the matching email
        const companiesWithStaff = await Promise.all(companies.map(async (company) => {
            const matchingStaff = await db('cinando_staff')
                .where('company_id', company.id)
                .whereILike('email', `%${email}%`)
                .select('id', 'name', 'role', 'sub_role', 'email', 'phone', 'mobile');

            return {
                ...company,
                matching_staff: matchingStaff
            };
        }));

        res.status(200).json({
            success: true,
            data: companiesWithStaff,
            pagination: {
                total: parseInt(count),
                page,
                limit,
                pages: Math.ceil(parseInt(count) / limit)
            }
        });
    } catch (error) {
        console.error("Error filtering companies by email:", error);
        res.status(500).json({
            success: false,
            message: "Failed to filter companies by email",
            error: error.message
        });
    }
});

// GET endpoint to filter companies based on staff contact number
router.get("/companies/by-phone", async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone query parameter is required"
            });
        }

        // Fix pagination
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 50;
        if (![25, 50, 100].includes(limit)) {
            limit = 50;
        }
        const offset = (page - 1) * limit;

        // First find staff with matching phone/mobile
        const staffWithPhone = await db('cinando_staff')
            .where(function() {
                this.whereILike('phone', `%${phone}%`)
                    .orWhereILike('mobile', `%${phone}%`);
            })
            .select('company_id')
            .whereNotNull('company_id')
            .distinct('company_id');

        if (staffWithPhone.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    pages: 0
                }
            });
        }

        // Get the company IDs
        const companyIds = staffWithPhone.map(item => item.company_id);

        // Build query to get companies
        let query = db('cinando_companies')
            .whereIn('id', companyIds);

        // Apply additional filters if provided
        if (req.query.name) {
            query = query.whereILike('name', `%${req.query.name}%`);
        }

        if (req.query.location) {
            query = query.whereILike('address', `%${req.query.location}%`);
        }

        // Execute count query
        const countQuery = query.clone();
        const [{ count }] = await countQuery.count('* as count');

        // Execute main query with pagination
        const companies = await query
            .select('*')
            .orderBy('name', 'asc')
            .limit(limit)
            .offset(offset);

        // For each company, get staff with the matching phone/mobile
        const companiesWithStaff = await Promise.all(companies.map(async (company) => {
            const matchingStaff = await db('cinando_staff')
                .where('company_id', company.id)
                .where(function() {
                    this.whereILike('phone', `%${phone}%`)
                        .orWhereILike('mobile', `%${phone}%`);
                })
                .select('id', 'name', 'role', 'sub_role', 'email', 'phone', 'mobile');

            return {
                ...company,
                matching_staff: matchingStaff
            };
        }));

        res.status(200).json({
            success: true,
            data: companiesWithStaff,
            pagination: {
                total: parseInt(count),
                page,
                limit,
                pages: Math.ceil(parseInt(count) / limit)
            }
        });
    } catch (error) {
        console.error("Error filtering companies by phone:", error);
        res.status(500).json({
            success: false,
            message: "Failed to filter companies by phone",
            error: error.message
        });
    }
});
// GET endpoint to filter companies by activities
router.get("/companies/by-activities", async (req, res) => {
    try {
        // Get activities from query parameter (comma-separated)
        const { activities } = req.query;
        
        if (!activities) {
            return res.status(400).json({
                success: false,
                message: "Activities query parameter is required (comma-separated list)"
            });
        }
        
        // Parse the activities into an array
        const activityList = activities.split(',').map(item => item.trim());
        
        if (activityList.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one activity must be provided"
            });
        }
        
        // Fix pagination
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 50;
        if (![25, 50, 100].includes(limit)) {
            limit = 50;
        }
        const offset = (page - 1) * limit;
        
        // Allow selective field fetching
        const fields = req.query.fields ? req.query.fields.split(',') : ['*'];
        
        // Add sorting option
        const sortBy = req.query.sortBy || 'name';
        const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
        
        // Build base query
        let query = db('cinando_companies');
        
        // Apply activity filters using PostgreSQL JSONB syntax
        // We need companies that have ANY of the activities (OR logic)
        if (activityList.length === 1) {
            // Simple case with a single activity
            query = query.whereRaw(`activities ?? ?`, [activityList[0]]);
        } else {
            // Multiple activities - any match (OR condition)
            query = query.where(function() {
                for (const activity of activityList) {
                    this.orWhereRaw(`activities ?? ?`, [activity]);
                }
            });
        }
        
        // Additional filtering options
        
        // Filter by name
        if (req.query.name) {
            query = query.whereILike('name', `%${req.query.name}%`);
        }
        
        // Filter by location
        if (req.query.location) {
            query = query.whereILike('address', `%${req.query.location}%`);
        }
        
        // Get count for pagination
        const countQuery = query.clone();
        const [{ count }] = await countQuery.count('* as count');
        
        // Execute main query with pagination and sorting
        const companies = await query
            .select(fields)
            .orderBy(sortBy, sortOrder)
            .limit(limit)
            .offset(offset);
        
        // For better user experience, add a field showing which activities matched
        const companiesWithMatchedActivities = companies.map(company => {
            let matchedActivities = [];
            
            if (company.activities) {
                const companiesActivities = typeof company.activities === 'string' 
                    ? JSON.parse(company.activities) 
                    : company.activities;
                
                matchedActivities = activityList.filter(activity => 
                    companiesActivities && activity in companiesActivities);
            }
            
            return {
                ...company,
                matched_activities: matchedActivities
            };
        });
        
        res.status(200).json({
            success: true,
            data: companiesWithMatchedActivities,
            filter: {
                activities: activityList
            },
            pagination: {
                total: parseInt(count),
                page,
                limit,
                pages: Math.ceil(parseInt(count) / limit)
            }
        });
    } catch (error) {
        console.error("Error filtering companies by activities:", error);
        res.status(500).json({
            success: false,
            message: "Failed to filter companies by activities",
            error: error.message
        });
    }
});
export default router;