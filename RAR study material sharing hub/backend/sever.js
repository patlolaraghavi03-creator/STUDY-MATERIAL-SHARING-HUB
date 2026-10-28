// ==========================================
// STUDY MATERIAL SHARING HUB
// Express Backend Server
// ==========================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = require("./supabase");

const app = express();

const PORT = process.env.PORT || 5000;

const BUCKET = "study-materials";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ==========================================
// 1. MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json({ limit: "20kb" }));

// ==========================================
// 2. PDF UPLOAD CONFIGURATION
// ==========================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: MAX_FILE_SIZE
    },

    fileFilter: (req, file, callback) => {

        const validExtension =
            file.originalname.toLowerCase().endsWith(".pdf");

        const validType =
            file.mimetype === "application/pdf";

        if (!validExtension || !validType) {
            return callback(
                new Error("Only PDF files are allowed.")
            );
        }

        callback(null, true);
    }
});

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        message: message
    });
}

function validateMaterial(body) {

    const { title, subject, description } = body;

    if (
        typeof title !== "string" ||
        typeof subject !== "string" ||
        typeof description !== "string"
    ) {
        return "All material details are required.";
    }

    if (
        title.trim().length < 1 ||
        title.trim().length > 100
    ) {
        return "Title must contain 1 to 100 characters.";
    }

    if (
        subject.trim().length < 1 ||
        subject.trim().length > 100
    ) {
        return "Subject must contain 1 to 100 characters.";
    }

    if (
        description.trim().length < 1 ||
        description.trim().length > 500
    ) {
        return "Description must contain 1 to 500 characters.";
    }

    return null;
}

function isValidUUID(value) {
    return typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(value);
}

function createUserClient(token) {

    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
}

// ==========================================
// 4. AUTHENTICATION MIDDLEWARE
// ==========================================

async function requireAuth(req, res, next) {

    try {

        const authorization = req.headers.authorization;

        if (
            !authorization ||
            !authorization.startsWith("Bearer ")
        ) {
            return sendError(
                res,
                401,
                "Please log in first."
            );
        }

        const token = authorization.slice(7).trim();

        if (!token) {
            return sendError(res, 401, "Missing access token.");
        }

        const { data, error } =
            await supabase.auth.getUser(token);

        if (error || !data.user) {
            return sendError(
                res,
                401,
                "Invalid or expired login session."
            );
        }

        req.user = data.user;

        // This client uses the student's identity.
        // Supabase RLS policies will apply.
        req.userSupabase = createUserClient(token);

        next();

    } catch (error) {

        next(error);
    }
}

// ==========================================
// 5. HOME API
// ==========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Study Material Sharing Hub API is running!"
    });

});

// ==========================================
// 6. STUDENT SIGN-UP
// ==========================================

app.post("/api/auth/signup", async (req, res, next) => {

    try {

        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return sendError(
                res,
                400,
                "Email and password are required."
            );
        }

        const cleanEmail = email.trim();

        if (
            cleanEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return sendError(
                res,
                400,
                "Enter a valid email address."
            );
        }

        if (password.length < 8) {
            return sendError(
                res,
                400,
                "Password must contain at least 8 characters."
            );
        }

        const { data, error } =
            await supabase.auth.signUp({
                email: cleanEmail,
                password: password
            });

        if (error) {
            return sendError(res, 400, error.message);
        }

        res.status(201).json({
            success: true,
            message: data.session
                ? "Account created successfully."
                : "Check your email to confirm your account.",
            user: data.user
                ? {
                    id: data.user.id,
                    email: data.user.email
                }
                : null
        });

    } catch (error) {
        next(error);
    }
});

// ==========================================
// 7. STUDENT LOGIN
// ==========================================

app.post("/api/auth/login", async (req, res, next) => {

    try {

        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return sendError(
                res,
                400,
                "Email and password are required."
            );
        }

        const { data, error } =
            await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password
            });

        if (error) {
            return sendError(res, 401, error.message);
        }

        res.json({
            success: true,
            message: "Login successful.",
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            user: {
                id: data.user.id,
                email: data.user.email
            }
        });

    } catch (error) {
        next(error);
    }
});

// ==========================================
// 8. GET ALL MATERIALS AND SEARCH
// ==========================================

app.get("/api/materials", async (req, res, next) => {

    try {

        const search = req.query.search;

        if (
            search !== undefined &&
            (typeof search !== "string" || search.length > 100)
        ) {
            return sendError(res, 400, "Invalid search text.");
        }

        let query = supabase
            .from("materials")
            .select(
                "id, title, subject, description, file_path, user_id, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(100);

        if (search && search.trim()) {

            // Search safely in JavaScript for this small project.
            // This avoids inserting user input into a filter expression.

            const { data, error } = await supabase
                .from("materials")
                .select(
                    "id, title, subject, description, file_path, user_id, created_at"
                )
                .order("created_at", { ascending: false })
                .limit(1000);

            if (error) {
                throw error;
            }

            const term = search.trim().toLowerCase();

            const results = data.filter(material =>
                material.title.toLowerCase().includes(term) ||
                material.subject.toLowerCase().includes(term)
            ).slice(0, 100);

            return res.json({
                success: true,
                count: results.length,
                materials: results
            });
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            count: data.length,
            materials: data
        });

    } catch (error) {
        next(error);
    }
});

// ==========================================
// 9. UPLOAD STUDY MATERIAL
// ==========================================

app.post(
    "/api/materials",
    requireAuth,
    upload.single("file"),
    async (req, res, next) => {

        try {

            const validationError =
                validateMaterial(req.body);

            if (validationError) {
                return sendError(res, 400, validationError);
            }

            if (!req.file) {
                return sendError(
                    res,
                    400,
                    "Please select a PDF file."
                );
            }

            // Basic PDF signature validation
            if (
                req.file.buffer.subarray(0, 5)
                    .toString("ascii") !== "%PDF-"
            ) {
                return sendError(
                    res,
                    400,
                    "The uploaded file is not a valid PDF."
                );
            }

            const filePath =
                `${req.user.id}/${randomUUID()}.pdf`;

            // Upload PDF to Supabase Storage
            const { error: uploadError } =
                await req.userSupabase.storage
                    .from(BUCKET)
                    .upload(filePath, req.file.buffer, {
                        contentType: "application/pdf",
                        upsert: false
                    });

            if (uploadError) {
                return sendError(
                    res,
                    400,
                    uploadError.message
                );
            }

            // Save details to PostgreSQL
            const { data, error } =
                await req.userSupabase
                    .from("materials")
                    .insert({
                        title: req.body.title.trim(),
                        subject: req.body.subject.trim(),
                        description: req.body.description.trim(),
                        file_path: filePath,
                        user_id: req.user.id
                    })
                    .select()
                    .single();

            if (error) {

                // Remove uploaded file if database insert fails
                await req.userSupabase.storage
                    .from(BUCKET)
                    .remove([filePath]);

                return sendError(res, 400, error.message);
            }

            res.status(201).json({
                success: true,
                message: "Material uploaded successfully.",
                material: data
            });

        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// 10. UPDATE MATERIAL DETAILS
// ==========================================

app.put(
    "/api/materials/:id",
    requireAuth,
    async (req, res, next) => {

        try {

            const { id } = req.params;

            if (!isValidUUID(id)) {
                return sendError(
                    res,
                    400,
                    "Invalid material ID."
                );
            }

            const validationError =
                validateMaterial(req.body);

            if (validationError) {
                return sendError(res, 400, validationError);
            }

            const { data, error } =
                await req.userSupabase
                    .from("materials")
                    .update({
                        title: req.body.title.trim(),
                        subject: req.body.subject.trim(),
                        description: req.body.description.trim()
                    })
                    .eq("id", id)
                    .eq("user_id", req.user.id)
                    .select()
                    .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data) {
                return sendError(
                    res,
                    404,
                    "Material not found or access denied."
                );
            }

            res.json({
                success: true,
                message: "Material updated successfully.",
                material: data
            });

        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// 11. DELETE STUDY MATERIAL
// ==========================================

app.delete(
    "/api/materials/:id",
    requireAuth,
    async (req, res, next) => {

        try {

            const { id } = req.params;

            if (!isValidUUID(id)) {
                return sendError(
                    res,
                    400,
                    "Invalid material ID."
                );
            }

            // Find material owned by logged-in student
            const { data: material, error: findError } =
                await req.userSupabase
                    .from("materials")
                    .select("id, file_path")
                    .eq("id", id)
                    .eq("user_id", req.user.id)
                    .maybeSingle();

            if (findError) {
                throw findError;
            }

            if (!material) {
                return sendError(
                    res,
                    404,
                    "Material not found or access denied."
                );
            }

            // Delete PDF from storage first
            const { error: storageError } =
                await req.userSupabase.storage
                    .from(BUCKET)
                    .remove([material.file_path]);

            if (storageError) {
                return sendError(
                    res,
                    500,
                    "Could not delete PDF file."
                );
            }

            // Delete database record
            const { data: deleted, error: deleteError } =
                await req.userSupabase
                    .from("materials")
                    .delete()
                    .eq("id", id)
                    .eq("user_id", req.user.id)
                    .select("id")
                    .maybeSingle();

            if (deleteError) {
                throw deleteError;
            }

            if (!deleted) {
                return sendError(
                    res,
                    404,
                    "Material record could not be deleted."
                );
            }

            res.json({
                success: true,
                message: "Material deleted successfully."
            });

        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// 12. DOWNLOAD MATERIAL
// ==========================================

app.get(
    "/api/materials/:id/download",
    async (req, res, next) => {

        try {

            const { id } = req.params;

            if (!isValidUUID(id)) {
                return sendError(
                    res,
                    400,
                    "Invalid material ID."
                );
            }

            const { data: material, error } =
                await supabase
                    .from("materials")
                    .select("file_path")
                    .eq("id", id)
                    .maybeSingle();

            if (error) {
                throw error;
            }

            if (!material) {
                return sendError(
                    res,
                    404,
                    "Material not found."
                );
            }

            const { data } = supabase.storage
                .from(BUCKET)
                .getPublicUrl(material.file_path, {
                    download: true
                });

            res.redirect(data.publicUrl);

        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// 13. HANDLE UNKNOWN API ROUTES
// ==========================================

app.use((req, res) => {

    return sendError(
        res,
        404,
        "API endpoint not found."
    );
});

// ==========================================
// 14. GLOBAL ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {

    console.error("Server error:", error.message);

    if (error instanceof multer.MulterError) {

        if (error.code === "LIMIT_FILE_SIZE") {
            return sendError(
                res,
                400,
                "PDF must be smaller than 5 MB."
            );
        }

        return sendError(res, 400, "Invalid file upload.");
    }

    if (error.message === "Only PDF files are allowed.") {
        return sendError(res, 400, error.message);
    }

    if (error.type === "entity.parse.failed") {
        return sendError(res, 400, "Invalid JSON data.");
    }

    res.status(500).json({
        success: false,
        message: "An internal server error occurred."
    });
});

// ==========================================
// 15. START SERVER
// ==========================================

app.listen(PORT, () => {

    console.log("--------------------------------");
    console.log("Study Material Sharing Hub");
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}`);
    console.log("--------------------------------");

});