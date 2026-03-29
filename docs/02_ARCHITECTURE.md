# Architecture & Technology Stack

## **1. Technology Stack**

This application follows a **Client-Server Architecture** using modern JavaScript frameworks.

### **Frontend (Client)**
-   **Framework**: [React Native](https://reactnative.dev/) via [Expo SDK 50](https://expo.dev/)
-   **Routing**: [Expo Router v3](https://docs.expo.dev/router/introduction/) (File-based routing)
-   **Language**: TypeScript (`.ts`, `.tsx`)
-   **State Management**: React Context & Hooks (`useState`, `useEffect`)
-   **Networking**: Axios (HTTP Client)
-   **UI/Design**: Styled components (React Native StyleSheet), `@expo/vector-icons`
-   **Animations**: `react-native-reanimated`
-   **Local Storage**: `@react-native-async-storage/async-storage` (for JWT & User Data)

### **Backend (Server)**
-   **Runtime**: [Node.js](https://nodejs.org/)
-   **Framework**: [Express.js](https://expressjs.com/)
-   **Database**: [SQLite](https://www.sqlite.org/) (File-based relational DB)
-   **ORM/Driver**: `sqlite` & `sqlite3` (Async/Await wrapper)
-   **Authentication**:
    -   `jsonwebtoken` (JWT Access & Refresh Strategy)
    -   `bcryptjs` (Password Hashing)
-   **Environment**: `dotenv` for configuration

---

## **2. System Architecture Diagram**

```mermaid
graph TD
    User((User)) -->|Interacts| Client[Mobile Client (React Native)]
    
    subgraph Client App
        Client -->|Navigation| Router[Expo Router]
        Router -->|Render| Screens[Screens (Home, Attendance, Reports)]
        Screens -->|API Call| Services[Axios Service Layer]
    end
    
    Services -->|HTTP Request (JSON)| Server[Node.js / Express Server]
    
    subgraph Backend Server
        Server -->|Route Request| Routes[API Routes]
        Routes -->|Validate| Middleware[Auth Middleware (JWT)]
        Middleware -->|Controller Logic| Controllers[Business Logic]
        Controllers -->|SQL Query| DB_Driver[SQLite Driver]
    end
    
    DB_Driver -->|Read/Write| Database[(SQLite Database file)]
    
    Database -.->|Data| DB_Driver
    DB_Driver -.->|Result| Controllers
    Controllers -.->|JSON Response| Services
    Services -.->|Update State| Screens
```

---

## **3. Folder Structure Breakdown**

### **Client Structure (`/client`)**
*   **`src/app`**: The core application logic and routing.
    *   **`(tabs)`**: Contains the main tab navigator (Home, Sites, Reports).
    *   **`(screens)`**: Standalone screens not in the tab bar (Auth, Profile).
    *   **`_layout.tsx`**: Defins the root layout/navigation stack.
*   **`src/components`**: Reusable UI components (Buttons, Cards, Modals).
*   **`src/services`**: API integration.
    *   `api.ts`: Central Axios instance with interceptors for token refresh.
*   **`src/constants.ts`**: App-wide constants (API URL, Colors).

### **Server Structure (`/server`)**
*   **`index.js`**: Entry point. Initializes Express, Middleware, and Database.
*   **`database.js`**: Handles SQLite connection and schema migrations/initialization.
*   **`middleware/`**:
    *   `auth.js`: Verifies JWT tokens and attaches user user info to `req.user`.
*   **`routes/`**: Defines API endpoints.
    *   `auth.js`: Signin/Signup logic.
    *   `attendance.js`: Marking and viewing attendance.
    *   `labours.js`: CRUD for labour profiles.
    *   `sites.js`: Site management.
    *   `overtime.js`: Overtime recording.
    *   `reports.js`: Aggregated data for admin views.

---

## **4. Data Flow Patterns**

### **Request Lifecycle**
1.  **User Action**: User taps "Submit Attendance" on the mobile app.
2.  **Client Validation**: React State ensures all fields are filled.
3.  **API Call**: `axios.post('/attendance')` is triggered.
    *   The `Authorization` header (`Bearer <token>`) is attached automatically via interceptor.
4.  **Server Authentication**: `authenticateToken` middleware verifies the JWT.
    *   If valid, `req.user` is populated.
    *   If expired, the client attempts to use the Refresh Token to get a new Access Token.
5.  **Business Logic**:
    *   The route handler verifies rules (e.g., "Is date in future?", "Is attendance locked?").
    *   A Database Transaction (`BEGIN TRANSACTION`) starts.
6.  **Database Operation**:
    *   Multiple rows are inserted into `attendance`.
    *   The `daily_site_attendance_status` table is updated to `locked = 1`.
    *   `COMMIT` is executed if all succeed; `ROLLBACK` on error.
7.  **Response**: Server sends `200 OK` JSON back to client.
8.  **UI Update**: Client shows "Success" toast and navigates back.
