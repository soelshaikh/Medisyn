# Feature Specification: Admin Reports & Dashboard

**Feature Branch**: `008-admin-reports-dashboard`

**Created**: 2026-10-11

**Status**: Draft

**Input**: Phase 8 — read-only analytics and dashboard summary endpoints for the MediSyn admin panel.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sales Reports (Priority: P1)

A pharmacy admin needs to understand revenue performance over time to make stocking and staffing decisions. They can view total revenue, order count, average order value, and top-selling products for any date range, grouped by day, week, or month.

**Why this priority**: Revenue visibility is the most critical business metric. Without it, admins cannot evaluate pharmacy performance or plan inventory purchasing.

**Independent Test**: Request sales report for the last 30 days → response includes total revenue, order count, average order value, and a list of top 10 products sorted by revenue.

**Acceptance Scenarios**:

1. **Given** an admin is authenticated, **When** they request the sales report with `from=2026-10-01&to=2026-10-31&period=daily`, **Then** the response contains a revenue trend array with one entry per day, total revenue, order count, and average order value for the period.
2. **Given** orders exist in multiple statuses, **When** the sales report is requested, **Then** only orders with status `delivered` or `shipped` contribute to revenue totals (cancelled and pending orders are excluded).
3. **Given** no orders exist in the date range, **When** the sales report is requested, **Then** the response returns zeros rather than an error.
4. **Given** no `period` is specified, **When** the sales report is requested, **Then** the system defaults to `monthly` grouping.

---

### User Story 2 — Order Reports (Priority: P2)

A pharmacy admin needs to monitor operational health: how orders flow through statuses, how quickly they are fulfilled, and what proportion are cancelled. This helps identify bottlenecks and set expectations with patients.

**Why this priority**: Operational metrics directly affect patient satisfaction. Cancellation rates and fulfilment delays surface workflow problems early.

**Independent Test**: Request order report for last 30 days → response includes count per status, cancellation rate percentage, average fulfilment time in hours, and a daily order volume array for chart rendering.

**Acceptance Scenarios**:

1. **Given** orders exist across multiple statuses, **When** the order report is requested, **Then** the response includes a breakdown of order counts for each status: `pending`, `processing`, `shipped`, `delivered`, `cancelled`.
2. **Given** orders with `shipped_at` and `placed_at` timestamps exist, **When** the order report is requested, **Then** average fulfilment time is the mean difference between `shipped_at` and `created_at` for all shipped/delivered orders in the period.
3. **Given** cancelled and total orders exist in the period, **When** the order report is requested, **Then** cancellation rate = (cancelled orders / total orders) × 100, expressed as a percentage rounded to one decimal place.

---

### User Story 3 — Patient Reports (Priority: P3)

A pharmacy admin tracks patient growth and engagement to understand acquisition trends and identify high-value patients. They see new registrations over time, total active patients, and top patients by lifetime order value.

**Why this priority**: Patient growth metrics support marketing and retention decisions. Useful but not blocking daily operations.

**Independent Test**: Request patient report for last 90 days → response includes new registration count per period, total active patient count, retention percentage (patients with more than one order), and top 10 patients by lifetime spend.

**Acceptance Scenarios**:

1. **Given** patients registered during the date range, **When** the patient report is requested, **Then** the response includes a time-series array of new registrations grouped by the requested period.
2. **Given** some patients have placed more than one order, **When** retention is requested, **Then** retention rate = (patients with ≥2 orders / patients with ≥1 order) × 100.
3. **Given** a request for top patients, **When** the patient report is requested, **Then** the top 10 patients are returned sorted by total lifetime order value descending, with patient ID, first name, last name, order count, and total spend.

---

### User Story 4 — Admin Dashboard Summary (Priority: P1)

A pharmacy admin opens the admin panel home screen and immediately sees a real-time health snapshot of the pharmacy: today's revenue, orders needing attention, pending prescriptions, new patients, and low-stock alerts — all in a single load.

**Why this priority**: The dashboard is the first screen every admin sees. Slow or incomplete dashboards reduce trust. This is P1 because it drives daily workflow decisions.

**Independent Test**: Call `GET /dashboard` → single response includes all six summary metrics: today's revenue, today's order count, new patients today, unread ask-pharmacist conversations, pending prescription requests, and low-stock product count.

**Acceptance Scenarios**:

1. **Given** an admin is authenticated at 9 AM, **When** they load the dashboard, **Then** "today" metrics reflect data since midnight in the facility's timezone (defaulting to UTC if timezone not configured).
2. **Given** inventory records exist, **When** the dashboard is loaded, **Then** low-stock count = products where `quantity_on_hand ≤ reorder_threshold` (products with no threshold set are excluded from low-stock count).
3. **Given** no activity has occurred today, **When** the dashboard is loaded, **Then** all today-metrics return 0 rather than null or an error.
4. **Given** the dashboard is requested, **When** the response is sent, **Then** all six metrics are returned in a single response — the admin panel does not need to make multiple API calls.

---

### Edge Cases

- What happens when `from` is after `to`? → Return 422 VALIDATION_ERROR.
- What happens when the date range spans more than 366 days? → Cap at 366 days maximum; return 422 if exceeded.
- What if `period=daily` is requested over a 6-month range (180+ data points)? → Allow up to 366 points; client is responsible for display.
- What if revenue calculations encounter NULL prices (deleted products)? → Use the stored `unit_price` on the order_item row, which is captured at order time and never changes.
- What if a facility has no orders at all? → Return zeros in all numeric fields; return empty arrays for trend data.
- What happens if the requesting admin has limited RBAC permissions? → All report endpoints require the `reports.read` permission; return 403 if absent.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a sales report endpoint that returns revenue totals, order count, average order value, and a time-series trend for a given date range and period granularity (`daily`, `weekly`, `monthly`).
- **FR-002**: The system MUST provide a top-products sub-report within the sales report showing the top 10 products by total revenue and by units sold for the date range, with configurable limit (max 50).
- **FR-003**: The system MUST exclude cancelled and pending orders from revenue calculations; only `shipped` and `delivered` orders contribute to revenue totals.
- **FR-004**: The system MUST provide an order report endpoint that returns a per-status count breakdown, cancellation rate, average fulfilment time, and a daily order volume time series.
- **FR-005**: The system MUST provide a patient report endpoint that returns new registration time series, total active patient count, retention rate, and top patients by lifetime spend.
- **FR-006**: The system MUST provide a single dashboard summary endpoint that aggregates all key metrics (today's revenue, today's order count, new patients today, unread ask-pharmacist conversations count, pending prescription count, low-stock product count) in one response.
- **FR-007**: All report endpoints MUST accept `from` and `to` ISO 8601 date query parameters. If omitted, `from` defaults to 30 days ago and `to` defaults to today.
- **FR-008**: All report endpoints MUST accept a `period` query parameter (`daily`, `weekly`, `monthly`) that controls the time-series grouping granularity. Default is `monthly`.
- **FR-009**: All endpoints MUST be facility-scoped — data returned is only for the requesting admin's facility.
- **FR-010**: All endpoints MUST require `reports.read` RBAC permission; return 403 if the permission is absent.
- **FR-011**: Date range MUST be validated: `from` must not be after `to`, and range must not exceed 366 days.
- **FR-012**: Low-stock count on the dashboard MUST count inventory records where current quantity is at or below the configured reorder threshold. Products without a reorder threshold are excluded.

### Key Entities

- **Sales Report**: Aggregated view of orders — revenue, count, AOV, trend over time, top products.
- **Order Report**: Operational view — per-status counts, fulfilment time, cancellation rate, volume trend.
- **Patient Report**: Growth view — new registrations, active count, retention, top spenders.
- **Dashboard Summary**: Real-time snapshot — six KPI metrics for the current day.
- **Report Period**: The grouping granularity for time-series data (daily / weekly / monthly).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can load the dashboard summary in under 500ms for a facility with up to 10,000 orders.
- **SC-002**: All four report endpoints respond in under 2 seconds for a 90-day date range.
- **SC-003**: Revenue figures on sales reports match the sum of order totals in the database with zero discrepancy (exact integer cent arithmetic, no floating-point rounding errors).
- **SC-004**: All six dashboard metrics are returned in a single HTTP request — no client-side fan-out required.
- **SC-005**: Reports return consistent results when called multiple times for the same date range (deterministic, no randomness).
- **SC-006**: Admins without `reports.read` permission receive a clear 403 response, not a 500 or empty result.

---

## Assumptions

- Revenue is stored in integer cents in the database — no floating-point arithmetic is performed at the application layer.
- All four endpoints are admin-panel only; patients and clinic users cannot access them.
- "Active patient" means a patient who has placed at least one order or submitted at least one prescription request in the past 12 months.
- Timezone handling defaults to UTC for all date bucketing unless a facility timezone is stored (out of scope for this phase to add timezone configuration).
- Top-products report uses `unit_price × quantity` from `order_items` (captured at order time), not current product prices.
- "Low-stock" threshold is a field already present on inventory records (`reorder_threshold`); this phase does not add new fields.
- Dashboard "today" window is midnight UTC to current timestamp UTC.
- Pagination is not required on report endpoints; all results fit in a single response (top-N lists capped at 50, time series capped at 366 points).
- No caching layer is required for this phase; queries run directly against PostgreSQL on each request.
