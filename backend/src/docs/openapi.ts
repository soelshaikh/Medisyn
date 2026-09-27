/**
 * MediSyn REST API — OpenAPI 3.0 specification.
 * Served by swagger-ui-express at GET /api/docs.
 */
export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title:       "MediSyn API",
    description: "Canadian pharmacy/healthcare platform REST API",
    version:     "1.0.0",
    contact: {
      name:  "MediSyn Development",
      email: "dev@medisyn.ca",
    },
  },
  servers: [
    { url: "/api/v1", description: "Current environment" },
  ],
  tags: [
    { name: "Auth",          description: "Authentication & session management" },
    { name: "Users",         description: "User management (admin)" },
    { name: "Roles",         description: "RBAC roles" },
    { name: "Permissions",   description: "RBAC permissions" },
    { name: "Products",      description: "Product catalogue" },
    { name: "Categories",    description: "Product categories" },
    { name: "Inventory",     description: "Inventory management" },
    { name: "Coupons",       description: "Discount coupons" },
    { name: "Cart",          description: "Shopping cart" },
    { name: "Orders",        description: "Order management" },
    { name: "Prescriptions", description: "Prescription requests" },
    { name: "Compounding",   description: "Compounding requests" },
    { name: "Ask Pharmacist", description: "Ask a pharmacist" },
    { name: "Minor Ailments", description: "Minor ailment requests" },
    { name: "Appointments",  description: "Vaccine appointments" },
    { name: "Vaccine Services", description: "Vaccine service catalogue" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "Files",         description: "File upload & signed URLs" },
    { name: "Reports",       description: "Analytics & reporting (admin)" },
    { name: "Dashboard",     description: "Admin dashboard metrics" },
    { name: "FAQs",          description: "Frequently asked questions" },
    { name: "Audit",         description: "Admin audit log" },
    { name: "Health",        description: "Health check" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type:         "http",
        scheme:       "bearer",
        bearerFormat: "JWT",
        description:  "Access token from POST /auth/login",
      },
    },
    schemas: {
      ApiSuccess: {
        type: "object",
        properties: {
          success:    { type: "boolean", example: true },
          data:       { },
          message:    { type: "string" },
        },
      },
      ApiError: {
        type: "object",
        properties: {
          success:    { type: "boolean", example: false },
          error:      { type: "string" },
          statusCode: { type: "integer" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          data:  { type: "array", items: {} },
          total: { type: "integer" },
          page:  { type: "integer" },
          limit: { type: "integer" },
        },
      },
      StatusEntry: {
        type: "object",
        properties: {
          status:        { type: "string" },
          changedAt:     { type: "string", format: "date-time" },
          changedByName: { type: "string" },
          note:          { type: "string" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Authentication required",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
      Forbidden: {
        description: "Insufficient permissions",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
      NotFound: {
        description: "Resource not found",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
      ValidationError: {
        description: "Validation failed",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    /* ─────────── Health ─────────── */
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        responses: {
          "200": { description: "Service is healthy" },
        },
      },
    },

    /* ─────────── Auth ─────────── */
    "/auth/register": {
      post: {
        tags: ["Auth"], summary: "Register a new patient account", security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object", required: ["fullName", "email", "password"],
            properties: {
              fullName: { type: "string" },
              email:    { type: "string", format: "email" },
              password: { type: "string", minLength: 8 },
              phone:    { type: "string" },
            },
          }}},
        },
        responses: {
          "201": { description: "Registered — verification email sent" },
          "422": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"], summary: "Login and get access + refresh tokens", security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object", required: ["email", "password"],
            properties: {
              email:    { type: "string", format: "email" },
              password: { type: "string" },
            },
          }}},
        },
        responses: {
          "200": { description: "Login successful — sets httpOnly refresh cookie, returns accessToken" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/logout":           { post: { tags: ["Auth"], summary: "Logout — clears refresh cookie", responses: { "200": { description: "Logged out" } } } },
    "/auth/refresh":          { post: { tags: ["Auth"], summary: "Refresh access token using httpOnly cookie", security: [], responses: { "200": { description: "New access token" } } } },
    "/auth/verify-email":     { post: { tags: ["Auth"], summary: "Verify email with OTP", security: [], responses: { "200": { description: "Email verified" } } } },
    "/auth/forgot-password":  { post: { tags: ["Auth"], summary: "Request password reset email", security: [], responses: { "200": { description: "Reset email sent" } } } },
    "/auth/reset-password":   { post: { tags: ["Auth"], summary: "Reset password with token", security: [], responses: { "200": { description: "Password updated" } } } },

    /* ─────────── Users ─────────── */
    "/users": {
      get: {
        tags: ["Users"], summary: "List users (admin)",
        parameters: [
          { name: "page",   in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",  in: "query", schema: { type: "integer", default: 25 } },
          { name: "role",   in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated user list" } },
      },
    },
    "/users/me": { get: { tags: ["Users"], summary: "Get current user profile", responses: { "200": { description: "Current user" } } } },
    "/users/{id}": {
      get:   { tags: ["Users"], summary: "Get user by ID (admin)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "User detail" } } },
      patch: { tags: ["Users"], summary: "Update user (admin)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated user" } } },
    },

    /* ─────────── Products ─────────── */
    "/products": {
      get:  { tags: ["Products"], summary: "List active products (public)", security: [], responses: { "200": { description: "Product list" } } },
      post: { tags: ["Products"], summary: "Create product (admin)", responses: { "201": { description: "Created product" } } },
    },
    "/products/{slug}": {
      get: { tags: ["Products"], summary: "Get product by slug (public)", security: [], parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Product detail" } } },
    },
    "/products/{id}/images": {
      post:   { tags: ["Products"], summary: "Upload product image", requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" }, alt: { type: "string" }, isPrimary: { type: "boolean" } } } } } }, responses: { "200": { description: "Image added" } } },
      delete: { tags: ["Products"], summary: "Remove product image", responses: { "200": { description: "Image removed" } } },
    },

    /* ─────────── Cart ─────────── */
    "/cart": {
      get: { tags: ["Cart"], summary: "Get cart (guest or authenticated)", security: [], responses: { "200": { description: "Cart contents" } } },
    },
    "/cart/items": {
      post: { tags: ["Cart"], summary: "Add item to cart", security: [], responses: { "200": { description: "Cart updated" } } },
    },
    "/cart/coupon": {
      post:   { tags: ["Cart"], summary: "Apply coupon code", security: [], responses: { "200": { description: "Coupon applied" } } },
      delete: { tags: ["Cart"], summary: "Remove coupon", security: [], responses: { "200": { description: "Coupon removed" } } },
    },

    /* ─────────── Orders ─────────── */
    "/orders/checkout": {
      post: {
        tags: ["Orders"], summary: "Place an order (guest or authenticated)", security: [],
        responses: {
          "201": { description: "Order placed" },
          "409": { description: "Inventory conflict" },
        },
      },
    },
    "/orders/my":        { get: { tags: ["Orders"], summary: "List current user's orders", responses: { "200": { description: "Order list" } } } },
    "/orders/my/{id}":   { get: { tags: ["Orders"], summary: "Get order detail", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Order detail" } } } },
    "/orders/admin":     { get: { tags: ["Orders"], summary: "List all orders (admin)", responses: { "200": { description: "Paginated order list" } } } },
    "/orders/admin/{id}/status": { patch: { tags: ["Orders"], summary: "Update order status", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Status updated" } } } },

    /* ─────────── Compounding ─────────── */
    "/compounding": {
      post: { tags: ["Compounding"], summary: "Submit compounding request (patient)", responses: { "201": { description: "Request created" } } },
      get:  { tags: ["Compounding"], summary: "List patient's compounding requests", responses: { "200": { description: "Request list" } } },
    },
    "/compounding/admin":          { get:   { tags: ["Compounding"], summary: "List all compounding requests (admin)", responses: { "200": { description: "Paginated list" } } } },
    "/compounding/admin/{id}/status": { patch: { tags: ["Compounding"], summary: "Update compounding status (admin)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } } },

    /* ─────────── Ask Pharmacist ─────────── */
    "/ask-pharmacist": {
      post: { tags: ["Ask Pharmacist"], summary: "Submit a question to a pharmacist (patient)", responses: { "201": { description: "Question submitted" } } },
      get:  { tags: ["Ask Pharmacist"], summary: "List patient's questions", responses: { "200": { description: "Question list" } } },
    },
    "/ask-pharmacist/admin":             { get:  { tags: ["Ask Pharmacist"], summary: "List all questions (admin)", responses: { "200": { description: "Paginated list" } } } },
    "/ask-pharmacist/admin/{id}/respond": { post: { tags: ["Ask Pharmacist"], summary: "Respond to a question (admin)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Response sent" } } } },

    /* ─────────── Appointments ─────────── */
    "/appointments":              { post: { tags: ["Appointments"], summary: "Book an appointment (patient)", responses: { "201": { description: "Booked" } } } },
    "/appointments/available-slots": { get: { tags: ["Appointments"], summary: "Get available appointment slots (public)", security: [], parameters: [{ name: "vaccineServiceId", in: "query", schema: { type: "string" } }, { name: "from", in: "query", schema: { type: "string" } }, { name: "to", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Available slots" } } } },
    "/appointments/admin":        { get:   { tags: ["Appointments"], summary: "List all bookings (admin)", responses: { "200": { description: "Paginated list" } } } },
    "/appointments/admin/{id}/status": { patch: { tags: ["Appointments"], summary: "Update booking status (admin)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } } },

    /* ─────────── Files ─────────── */
    "/files/upload": {
      post: {
        tags: ["Files"], summary: "Upload a file",
        parameters: [{ name: "type", in: "query", schema: { type: "string", enum: ["product-image", "document"], default: "document" } }],
        requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } } },
        responses: { "200": { description: "Uploaded — returns { key, url }" } },
      },
    },
    "/files/signed-url": {
      get: {
        tags: ["Files"], summary: "Get a 1-hour presigned URL for a private document",
        parameters: [{ name: "key", in: "query", required: true, schema: { type: "string" }, description: "Storage key returned by /files/upload, or a full http URL (passed through)" }],
        responses: { "200": { description: "{ url, expiresIn }" } },
      },
    },

    /* ─────────── Notifications ─────────── */
    "/notifications":           { get:  { tags: ["Notifications"], summary: "List notifications (paginated)", responses: { "200": { description: "Notification list" } } } },
    "/notifications/unread-count": { get: { tags: ["Notifications"], summary: "Get unread notification count", responses: { "200": { description: "{ count }" } } } },
    "/notifications/{id}/read":  { patch: { tags: ["Notifications"], summary: "Mark notification as read", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Marked read" } } } },
    "/notifications/read-all":   { post:  { tags: ["Notifications"], summary: "Mark all notifications as read", responses: { "200": { description: "All marked read" } } } },

    /* ─────────── Reports ─────────── */
    "/admin/reports/sales": {
      get: {
        tags: ["Reports"], summary: "Sales report",
        parameters: [
          { name: "preset", in: "query", schema: { type: "string", enum: ["today", "yesterday", "7d", "30d", "month"] } },
          { name: "from",   in: "query", schema: { type: "string", format: "date" } },
          { name: "to",     in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { "200": { description: "Revenue summary + daily chart" } },
      },
    },
    "/admin/reports/orders":    { get: { tags: ["Reports"], summary: "Order analytics",   parameters: [{ name: "preset", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Orders by status + daily chart" } } } },
    "/admin/reports/products":  { get: { tags: ["Reports"], summary: "Product analytics", parameters: [{ name: "preset", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Top products by qty + revenue" } } } },
    "/admin/reports/customers": { get: { tags: ["Reports"], summary: "Customer analytics",parameters: [{ name: "preset", in: "query", schema: { type: "string" } }], responses: { "200": { description: "New registrations + activity" } } } },
    "/admin/reports/coupons":   { get: { tags: ["Reports"], summary: "Coupon analytics",  parameters: [{ name: "preset", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Coupon usage stats" } } } },

    /* ─────────── Dashboard ─────────── */
    "/admin/dashboard/metrics": { get: { tags: ["Dashboard"], summary: "Admin dashboard KPIs + charts", responses: { "200": { description: "Dashboard metrics" } } } },

    /* ─────────── Audit ─────────── */
    "/admin/audit": { get: { tags: ["Audit"], summary: "Admin audit log (paginated)", responses: { "200": { description: "Audit entries" } } } },

    /* ─────────── FAQs ─────────── */
    "/faqs":        { get:  { tags: ["FAQs"], summary: "List published FAQs (public)", security: [], responses: { "200": { description: "FAQ list" } } } },
    "/admin/faqs":  { get:  { tags: ["FAQs"], summary: "List all FAQs (admin)", responses: { "200": { description: "FAQ list with drafts" } } }, post: { tags: ["FAQs"], summary: "Create FAQ", responses: { "201": { description: "Created" } } } },
  },
};
