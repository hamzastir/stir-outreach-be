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
        
        // Get staff count for this company
        const [{ count }] = await db('cinando_staff')
            .where('company_id', id)
            .count('* as count');
            
        // Get staff for this company with pagination
        const staffMembers = await db('cinando_staff')
            .where('company_id', id)
            .select('*')
            .limit(limit)
            .offset(offset);
            
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

export default router;