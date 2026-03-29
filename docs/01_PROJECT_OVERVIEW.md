# Project Overview: Construction Labour Management System

## **1. Introduction**
This project is a comprehensive **Labour Management System** designed for the construction industry. It streamlines the management of daily wage labourers across multiple job sites, ensuring accurate tracking of attendance, payments, and work history.

### **Core Purpose**
The primary goal is to digitize the manual process of tracking labour attendance and payments. It replaces paper-based muster rolls with a secure, digital system that provides real-time insights to administrators while empowering site supervisors with easy-to-use tools.

### **Target Audience**
-   **Administrators (Company Owners/Managers)**: Require high-level oversight of all sites, financial reports (salary, advances), and labour performance.
-   **Site Supervisors**: Require a simple interface to mark daily attendance, record overtime, and issue advances for labourers at their specific site.

### **Key Problem Solved**
-   **Eliminates Proxy Attendance**: Secure login and locked daily submissions prevent tampering.
-   **Accurate Wage Calculation**: Automates salary computation based on daily rates, attendance days, overtime, and deductions (advances).
-   **Transparency**: Real-time data visibility for admins prevents discrepancies between site records and payroll.

---

## **2. Developer Setup Guide**

Follow these steps to set up the development environment locally.

### **Prerequisites**
-   **Node.js**: v18.0.0 or higher.
-   **npm**: v9.0.0 or higher.
-   **Git**: Latest version.
-   **Expo Go** app (on mobile device) or Android Studio/Xcode (for simulation).

### **Installation**

1.  **Clone the Repository**
    ```bash
    git clone <repository_url>
    cd Proto
    ```

2.  **Server Setup**
    Navigate to the server directory and install dependencies.
    ```bash
    cd server
    npm install
    ```
    *   **Environment Variables**: Create a `.env` file in `server/`.
        ```
        PORT=5000
        JWT_SECRET=your_super_secret_key_here
        ```
    *   **Database**: The SQLite database (`proto.db`) will be automatically initialized when the server starts.

3.  **Client Setup**
    Navigate to the client directory and install dependencies.
    ```bash
    cd ../client
    npm install
    ```
    *   **API Configuration**: Open `client/src/constants.ts` and set `API_URL` to your machine's local IP address (e.g., `http://192.168.1.5:5000/api`). Do **not** use `localhost` if testing on a physical device.

### **Running the Application**

1.  **Start the Server**
    ```bash
    cd server
    node index.js
    # OR for development with auto-restart
    npx nodemon index.js
    ```
    *Output should confirm: `Server running on http://localhost:5000`*

2.  **Start the Client**
    ```bash
    cd client
    npx expo start
    ```
    *   Press `a` for Android Emulator.
    *   Press `w` for Web.
    *   Scan the QR code with Expo Go on your phone.

### **Linting & Code Quality**
-   **Linting**: Run `npm run lint` in the `client` directory to check for code style issues using ESLint.

---

## **3. Verification Scripts**
The `server` directory contains several verification scripts to test core logic without the frontend:
-   `node verify_attendance_lock.js`: Tests the daily locking mechanism.
-   `node verify_overtime.js`: Tests overtime calculations.
-   `node verify_labours.js`: Checks labour data integrity.
