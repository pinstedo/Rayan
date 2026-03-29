# API & Database Schema

## **1. Database Schema (SQLite)**

### **Users (`users`)**
Stores credentials for Admins and Supervisors.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique identifier |
| `name` | TEXT | Full name |
| `phone` | TEXT | Mobile number (Login ID) |
| `password_hash` | TEXT | Bcrypt hashed password |
| `role` | TEXT | `admin` or `supervisor` |
| `created_at` | DATETIME | Timestamp |

### **Labours (`labours`)**
Profiles of all workers in the system.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique identifier |
| `name` | TEXT | Full name |
| `phone` | TEXT | Contact number (optional) |
| `aadhaar` | TEXT | Identification number (optional) |
| `site_id` | INTEGER FK | Current assigned site (`sites.id`) |
| `rate` | REAL | Daily wage rate |
| `trade` | TEXT | Skill (e.g., Mason, Helper) |
| `status` | TEXT | `active`, `inactive` |

### **Sites (`sites`)**
Construction project locations.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique identifier |
| `name` | TEXT | Project name |
| `address` | TEXT | Location details |
| `created_by` | INTEGER FK | Admin user ID |

### **Attendance (`attendance`)**
Daily attendance records per labourer.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique identifier |
| `labour_id` | INTEGER FK | Worker ID |
| `site_id` | INTEGER FK | Site ID |
| `supervisor_id` | INTEGER FK | User ID who marked attendance |
| `date` | TEXT | Date string (YYYY-MM-DD) |
| `status` | TEXT | `full`, `half`, `absent` |
| `created_at` | DATETIME | Timestamp |

### **Daily Site Status (`daily_site_attendance_status`)**
Tracks if a site's attendance for a day is finalized.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique identifier |
| `site_id` | INTEGER FK | Site ID |
| `date` | TEXT | Date string (YYYY-MM-DD) |
| `is_locked` | BOOLEAN | `1` if submitted/locked, `0` otherwise |
| `food_provided` | BOOLEAN | `1` if food was given to workers |
| `submitted_by` | INTEGER FK | User ID who submitted |

### **Advances (`advances`)**
Records of payments made in advance.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique identifier |
| `labour_id` | INTEGER FK | Worker ID |
| `amount` | REAL | Payment amount |
| `date` | TEXT | Date of payment |
| `notes` | TEXT | Remarks |

### **Overtime (`overtime`)**
Records of extra work hours.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique identifier |
| `labour_id` | INTEGER FK | Worker ID |
| `site_id` | INTEGER FK | Site ID |
| `hours` | REAL | Hours worked |
| `amount` | REAL | Calculated pay for overtime |
| `date` | TEXT | Date of overtime |

---

## **2. API Reference**

All endpoints are prefixed with `/api`. Most require `Authorization: Bearer <token>`.

### **Authentication (`/auth`)**
| Method | Endpoint | Description | Public? |
| :--- | :--- | :--- | :--- |
| `POST` | `/signup` | Create new Admin account | Yes |
| `POST` | `/signin` | Login with Phone/Password | Yes |
| `POST` | `/refresh-token` | Get new Access Token using Refresh Token | Yes |
| `POST` | `/add-supervisor` | Create a Supervisor account | No (Admin only) |

### **Attendance (`/attendance`)**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Get attendance for a site/date (`?site_id=1&date=2023-10-27`) |
| `POST` | `/` | Submit daily attendance (batch). Locks the day. |
| `GET` | `/summary` | Get locked/submitted dates for a month (`?month=10&year=2023`) |
| `GET` | `/lock-status` | Check if a site/date is locked (`is_locked: boolean`) |

### **Labours (`/labours`)**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | List all labourers (optionally filter by site) |
| `POST` | `/` | Create a new labour profile |
| `PUT` | `/:id` | Update labour details |
| `DELETE` | `/:id` | Soft delete or deactivate labourer |

### **Dashboard (`/dashboard`)**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/stats` | Get admin dashboard stats (Total Labours, Active Sites, Today's Attendance count) |

### **Reports (`/reports`)**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/salary` | Generate salary report for a period. Logic: `(Days * Rate) + Overtime - Advances`. |
| `GET` | `/attendance-summary` | Aggregated attendance report per site. |
