// ======================================
// STUDY MATERIAL SHARING HUB
// Supabase Connection
// ======================================

require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

// Read Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Check environment variables
if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        "Missing Supabase configuration in .env file."
    );
}

// Create Supabase client
const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

// Export client for later use
module.exports = supabase;

// Test database connection when run directly
if (require.main === module) {

    async function testConnection() {

        try {
            console.log("Connecting to Supabase...");

            const { data, error } = await supabase
                .from("materials")
                .select("id")
                .limit(1);

            if (error) {
                throw error;
            }

            console.log("Supabase connection successful!");
            console.log("Materials table is accessible.");

        } catch (error) {

            console.error(
                "Supabase connection failed:",
                error.message
            );

            process.exitCode = 1;
        }
    }

    testConnection();
}