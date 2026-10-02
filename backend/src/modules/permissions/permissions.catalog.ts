export const PERMISSION_CATALOG: Array<{ key: string; group: string; description: string }> = [
  /* Users */
  { key: "users.read",         group: "users",         description: "View users" },
  { key: "users.create",       group: "users",         description: "Create users" },
  { key: "users.update",       group: "users",         description: "Update users" },
  { key: "users.suspend",      group: "users",         description: "Suspend/activate users" },
  { key: "users.delete",       group: "users",         description: "Delete users" },

  /* Roles */
  { key: "roles.read",         group: "roles",         description: "View roles" },
  { key: "roles.create",       group: "roles",         description: "Create roles" },
  { key: "roles.update",       group: "roles",         description: "Update roles and assign permissions" },
  { key: "roles.delete",       group: "roles",         description: "Delete roles" },
  { key: "roles.assign",       group: "roles",         description: "Assign roles to users" },

  /* Permissions */
  { key: "permissions.read",   group: "permissions",   description: "View permission catalog" },
  { key: "permissions.assign", group: "permissions",   description: "Assign direct permissions to users" },

  /* Products */
  { key: "products.read",      group: "products",      description: "View products" },
  { key: "products.create",    group: "products",      description: "Create products" },
  { key: "products.update",    group: "products",      description: "Update products" },
  { key: "products.delete",    group: "products",      description: "Delete/deactivate products" },

  /* Categories */
  { key: "categories.read",    group: "categories",    description: "View categories" },
  { key: "categories.create",  group: "categories",    description: "Create categories" },
  { key: "categories.update",  group: "categories",    description: "Update categories" },
  { key: "categories.delete",  group: "categories",    description: "Delete categories" },

  /* Inventory */
  { key: "inventory.read",           group: "inventory", description: "View inventory levels and product stock" },
  { key: "inventory.adjust",         group: "inventory", description: "Adjust inventory settings and stock quantities" },
  { key: "inventory.batches.recall", group: "inventory", description: "Recall (quarantine) a product batch" },
  { key: "inventory.movements.read", group: "inventory", description: "View inventory movement history" },

  /* Threads */
  { key: "threads.read",          group: "threads", description: "View message threads and internal notes" },
  { key: "threads.reply_patient", group: "threads", description: "Send messages to patients via thread" },
  { key: "threads.add_note",      group: "threads", description: "Add internal staff notes to threads" },

  /* Orders */
  { key: "orders.read",              group: "orders", description: "View orders" },
  { key: "orders.create",            group: "orders", description: "Create orders (admin)" },
  { key: "orders.update",            group: "orders", description: "Update order details" },
  { key: "orders.status.update",     group: "orders", description: "Move order through processing steps" },
  { key: "orders.status.confirm",    group: "orders", description: "Confirm a pending order" },
  { key: "orders.status.deliver",    group: "orders", description: "Mark an order as delivered/picked up" },
  { key: "orders.cancel",            group: "orders", description: "Cancel orders" },

  /* Email trigger configuration */
  { key: "email-triggers.read",   group: "email-triggers", description: "View email trigger configuration" },
  { key: "email-triggers.update", group: "email-triggers", description: "Enable/disable email triggers" },

  /* Coupons */
  { key: "coupons.read",       group: "coupons",       description: "View coupons" },
  { key: "coupons.create",     group: "coupons",       description: "Create coupons" },
  { key: "coupons.update",     group: "coupons",       description: "Update coupons" },
  { key: "coupons.delete",     group: "coupons",       description: "Delete coupons" },

  /* Prescriptions */
  { key: "prescriptions.read",             group: "prescriptions", description: "View prescription requests" },
  { key: "prescriptions.update",           group: "prescriptions", description: "Update prescription requests" },
  { key: "prescriptions.status.update",    group: "prescriptions", description: "Move prescription to received/cancelled (intake staff)" },
  { key: "prescriptions.status.verify",    group: "prescriptions", description: "Move prescription to verified (pharmacist only)" },
  { key: "prescriptions.status.dispense",  group: "prescriptions", description: "Move prescription to dispensed (pharmacist only)" },
  { key: "prescriptions.files.read",       group: "prescriptions", description: "View prescription attachments" },
  { key: "prescriptions.assign",           group: "prescriptions", description: "Assign prescription to pharmacist" },
  { key: "prescriptions.notes",            group: "prescriptions", description: "Add internal notes to prescriptions" },

  /* Compounding */
  { key: "compounding.read",             group: "compounding", description: "View compounding requests" },
  { key: "compounding.update",           group: "compounding", description: "Update compounding requests" },
  { key: "compounding.status.update",    group: "compounding", description: "Move compounding through intake/production steps" },
  { key: "compounding.status.approve",   group: "compounding", description: "Approve a compounding quote (pharmacist only)" },
  { key: "compounding.status.complete",  group: "compounding", description: "Mark compounding as ready/delivered (pharmacist only)" },
  { key: "compounding.files.read",       group: "compounding", description: "View compounding attachments" },
  { key: "compounding.assign",           group: "compounding", description: "Assign compounding to pharmacist" },
  { key: "compounding.notes",            group: "compounding", description: "Add internal notes to compounding" },

  /* Ask Pharmacist */
  { key: "ask-pharmacist.read",           group: "ask-pharmacist", description: "View pharmacist questions" },
  { key: "ask-pharmacist.respond",        group: "ask-pharmacist", description: "Respond to pharmacist questions" },
  { key: "ask-pharmacist.status.update",  group: "ask-pharmacist", description: "Update ask-pharmacist status" },
  { key: "ask-pharmacist.assign",         group: "ask-pharmacist", description: "Assign question to pharmacist" },
  { key: "ask-pharmacist.notes",          group: "ask-pharmacist", description: "Add internal notes" },
  { key: "ask-pharmacist.topics.manage",  group: "ask-pharmacist", description: "Manage ask-pharmacist topic catalog" },

  /* Minor Ailments */
  { key: "minor-ailments.read",            group: "minor-ailments", description: "View minor ailment requests" },
  { key: "minor-ailments.manage",          group: "minor-ailments", description: "Manage minor ailment service catalog" },
  { key: "minor-ailments.catalog.read",    group: "minor-ailments", description: "View minor ailment service catalog" },
  { key: "minor-ailments.catalog.manage",  group: "minor-ailments", description: "Manage minor ailment service catalog" },
  { key: "minor-ailments.requests.read",   group: "minor-ailments", description: "View minor ailment requests" },
  { key: "minor-ailments.requests.update", group: "minor-ailments", description: "Update minor ailment requests" },

  /* Appointments */
  { key: "appointments.read",               group: "appointments", description: "View appointments" },
  { key: "appointments.create",             group: "appointments", description: "Create appointments" },
  { key: "appointments.update",             group: "appointments", description: "Update appointments" },
  { key: "appointments.status.update",      group: "appointments", description: "Update appointment status" },
  { key: "appointments.availability.read",  group: "appointments", description: "View availability slots" },
  { key: "appointments.availability.manage",group: "appointments", description: "Create/edit/delete availability" },
  { key: "appointments.cancel",             group: "appointments", description: "Cancel appointments" },
  { key: "appointments.interest.read",      group: "appointments", description: "View appointment interest requests (no-slot submissions)" },
  { key: "appointments.interest.manage",    group: "appointments", description: "Update status of appointment interest requests" },

  /* Vaccines */
  { key: "vaccines.read",    group: "vaccines", description: "View vaccine services" },
  { key: "vaccines.create",  group: "vaccines", description: "Create vaccine services" },
  { key: "vaccines.update",  group: "vaccines", description: "Update vaccine services" },
  { key: "vaccines.delete",  group: "vaccines", description: "Delete vaccine services" },

  /* Clinics */
  { key: "clinics.read",     group: "clinics",  description: "View clinic registrations" },
  { key: "clinics.approve",  group: "clinics",  description: "Approve/reject clinics" },
  { key: "clinics.suspend",  group: "clinics",  description: "Suspend/deactivate clinics" },

  /* Pharmacy Partners */
  { key: "partners.read",    group: "partners", description: "View pharmacy partner registrations" },
  { key: "partners.approve", group: "partners", description: "Approve/reject pharmacy partners" },
  { key: "partners.suspend", group: "partners", description: "Suspend/deactivate pharmacy partners" },

  /* Reports */
  { key: "reports.read",     group: "reports",  description: "View reports and analytics" },

  /* Audit */
  { key: "audit.read",       group: "audit",    description: "View audit logs" },

  /* Notifications */
  { key: "notifications.read",   group: "notifications", description: "View notifications" },
  { key: "notifications.send",   group: "notifications", description: "Send notifications to users" },

  /* Content */
  { key: "content.faqs.read",   group: "content", description: "View FAQs" },
  { key: "content.faqs.manage", group: "content", description: "Create/edit/delete FAQs" },
  { key: "content.pages.manage",group: "content", description: "Manage static content pages" },

  /* Invoices */
  { key: "invoices.read",    group: "invoices", description: "View invoices and download PDFs" },
  { key: "invoices.create",  group: "invoices", description: "Create adhoc invoices" },
  { key: "invoices.void",    group: "invoices", description: "Void invoices" },
  { key: "invoices.reports", group: "invoices", description: "View invoice reports and revenue analytics" },

  /* Settings */
  { key: "settings.read",   group: "settings", description: "View platform settings" },
  { key: "settings.update", group: "settings", description: "Update platform settings" },
  { key: "settings.manage", group: "settings", description: "Manage pharmacy settings, hours, holidays" },
];

/* All permission keys for the ADMIN role */
export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);
