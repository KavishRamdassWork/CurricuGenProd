<div align="center">
  <h1>EduMaster Pro (CurricuGen)</h1>
  <p>An AI-powered, production-ready platform designed to seamlessly generate highly customized curriculum blueprints, lesson plans, and educational resources tailored to specific syllabus standards.</p>
</div>

## 📌 Overview

EduMaster Pro (now part of the CurricuGen suite) leverages the reasoning capabilities of Google Gemini AI to provide educators with a complete curriculum generation suite. Unlike the original client-side prototype, this production version is built on a robust, full-stack architecture. By analyzing granular class demographics, performance metrics, learning styles, and official syllabus materials (e.g., CAPS, Cambridge), the platform dynamically curates specialized content tailored to each student body.

## ✨ What Has Been Done & Why

This repository represents a major architectural upgrade from a basic React/Vite frontend to a full-stack Next.js application. Here is a breakdown of the recent enhancements and the reasoning behind them:

1. **Migration to Next.js (App Router)**
   - **Why:** The original app was a pure client-side React app. Migrating to Next.js provides Server-Side Rendering (SSR) for better performance, secure API routes to hide AI API keys, and a scalable architecture for future enhancements.
2. **Clerk Authentication Integration**
   - **Why:** To support individual educator profiles, save class data securely across sessions, and enable subscription gating. Clerk was chosen for its robust, secure, and drop-in authentication management.
3. **Database Integration (Prisma + PostgreSQL/SQLite)**
   - **Why:** Persistent storage was added to track user quotas, save generated lesson plans, and manage class profiles. Prisma provides type-safe database access, ensuring data integrity.
4. **Stripe/PayFast Subscription Gateway**
   - **Why:** The platform now supports a freemium model. Educators get a limited number of free generations before being prompted to upgrade to a Pro tier for unlimited access. We implemented robust webhook handlers to automatically update user subscription statuses upon successful payment.
5. **Dynamic AI Syllabus Ingestion (Curriculum Rules)**
   - **Why:** Instead of generic prompts, the AI now uses dynamic system instructions based on the selected curriculum standard (e.g., South African CAPS). We added a pipeline to ingest official syllabus PDFs, ensuring that the generated lesson plans strictly adhere to official outcomes and standards.
6. **Advanced Student Profiling**
   - **Why:** Generation prompts were extended to include *accommodations*, *learning styles*, and *student interests*. This ensures that the AI doesn't just generate generic content, but highly differentiated material suitable for the specific demographics of a classroom.
7. **Automated API Testing (Playwright)**
   - **Why:** To ensure production stability, we implemented Playwright tests to verify endpoint security (ensuring 404/401 rejections for unauthenticated access) and validate webhook payload processing.

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Authentication:** Clerk
- **Database ORM:** Prisma
- **AI Integration:** Google Gemini (`@google/genai`)
- **Payments:** PayFast / Stripe (Webhooks)
- **Testing:** Playwright

## 🚀 Getting Started (Local Development)

Follow these steps to clone the repository and run the project locally on any computer.

### Prerequisites

- Node.js (v18 or higher)
- A Google Gemini API Key
- A Clerk Account (for Auth keys)
- A local PostgreSQL/SQLite database (or a Neon/Supabase remote DB)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KavishRamdassWork/CurricuGenProd.git
   cd CurricuGenProd
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and configure the following variables:
   ```env
   # Database (Prisma)
   DATABASE_URL="file:./dev.db" # Or your Postgres connection string

   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...

   # Google Gemini AI
   API_KEY=your_gemini_api_key

   # PayFast / Stripe (Optional for local testing)
   PAYFAST_MERCHANT_ID=...
   PAYFAST_MERCHANT_KEY=...
   ```

4. **Initialize the Database**
   Push the schema to your database to set up the necessary tables (Users, Classrooms, etc.).
   ```bash
   npx prisma db push
   # or npx prisma migrate dev
   ```

5. **Start the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🧪 Running Tests
To run the automated API and security tests:
```bash
npx playwright test
```

## 📖 How It Works

1. **Setup a Class Profile:** Educators input their class demographics, average percentiles, learning styles, and required syllabus.
2. **Blueprint Generation:** The application interfaces with the Gemini API using strict syllabus-aligned system instructions to generate a term blueprint.
3. **Deep Dive Generation:** Educators can select specific weeks to generate granular materials—slides, worksheets, games, and assessments.
4. **Credit Tracking:** Each generation checks the user's database record. Free-tier users consume credits, while Pro users have unlimited access. 
