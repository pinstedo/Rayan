# Feature Logic & Business Rules

This document details the critical business logic, algorithms, and validation rules implemented in the system.

## **1. Attendance & Locking Mechanism**

The system enforces strict rules to ensure the integrity of attendance data.

### **Submission Logic**
-   **Role**: Site Supervisors mark attendance.
-   **Scope**: Attendance is marked for a specific **Site** and **Date**.
-   **Batch Processing**: Supervisors submit attendance for all labourers at once.
-   **Database Transaction**: The submission is wrapped in a transaction. Either all records are saved, or none are, preventing partial data states.

### **The "Daily Lock"**
-   **Trigger**: Upon successful submission of attendance for a Date/Site.
-   **Effect**: A record is inserted into the `daily_site_attendance_status` table with `is_locked = 1`.
-   **Consequence**: Any subsequent attempts to `POST /api/attendance` for that Date/Site are rejected by the backend (`403 Forbidden`).
-   **Unlock**: Currently, there is no UI for unlocking. This requires Admin database intervention, ensuring Supervisors cannot tamper with historical data.

---

## **2. Wage & Salary Calculation Algorithm**

The salary calculation logic is centralized in the **Reports Module** (`server/routes/reports.js`). It aggregates data from multiple sources to compute the "Net Payable" amount.

### **Core Formula**
```javascript
Net Payable = (Total Wage) + (Overtime Amount) + (Food Allowance) - (Advances)
```

### **Detailed Component Logic**

#### **A. Wage Calculation**
The system treats the `rate` stored in the `labours` table as an **Hourly Rate**.
-   **Full Day**: Calculated as **8 hours** of work.
-   **Half Day**: Calculated as **4 hours** of work.
-   **Absent**: 0 hours.

```javascript
Wage = (Full_Days * 8 * Hourly_Rate) + (Half_Days * 4 * Hourly_Rate)
```

#### **B. Food Allowance**
Labourers are entitled to a monetary allowance for food if the site did **not** provide meals on a working day.
-   **Check**: For every day the labourer was present (`Full` or `Half`):
    -   Check `daily_site_attendance_status` for that Site/Date.
    -   If `food_provided` is `FALSE` (or record missing), **Add Allowance**.
    -   If `food_provided` is `TRUE`, **No Allowance**.
-   **Amount**: Fixed at **70** currency units per applicable day.

#### **C. Overtime**
-   **Source**: Sum of the `amount` field in the `overtime` table.
-   **Note**: Overtime is recorded separately from standard daily attendance.

#### **D. Advances**
-   **Source**: Sum of the `amount` field in the `advances` table.
-   **Scope**: Advances are linked to the Labourer, not a specific site. Therefore, **all** advances for the labourer within the report period are deducted, regardless of which site they were working on.

---

## **3. Authentication & Security**

### **Token Strategy**
-   **Access Token**: Short-lived (15 minutes). Used for API authorization (`Authorization: Bearer <token>`).
-   **Refresh Token**: Long-lived (30 days). Stored securely in the `refresh_tokens` database table. Used to obtain new Access Tokens without re-login.
-   **Revocation**: Logging out revokes the Refresh Token in the database.

### **Role-Based Access Control (RBAC)**
-   **Admin**:
    -   Can management all data (Sites, Labours, Supervisors).
    -   Can view all reports.
    -   Can add new Supervisors.
-   **Supervisor**:
    -   Restricted to "Operational" tasks.
    -   Can viewing their assigned sites (implementation pending strict filtering).
    -   Can separate "manage" vs "view" permissions in future updates.

---

## **4. Error Handling & Edge Cases**

### **Validation Rules**
-   **Future Dates**: The system rejects attendance submission for future dates (`400 Bad Request`).
-   **Duplicate Phones**: User/Labour creation fails if the phone number already exists (`UNIQUE` constraint).

### **Concurrency Handling**
-   **Race Conditions**: SQLite `BEGIN IMMEDIATE` transactions (default in the driver wrapper) prevent two supervisors from locking the same site simultaneously. The first one wins; the second fails gracefully or is blocked until the first finishes.
