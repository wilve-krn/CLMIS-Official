# CLMIS — Computer Literacy Monitoring and Intervention System

Production-oriented CLMIS web application foundation.

## Included
- Student, Teacher, and protected Admin roles
- Supabase authentication and PostgreSQL database
- Student registration/profile and device background
- Pre-Test, Mid-Test, Post-Test
- 5 domains × 4 questions = 20 questions per assessment
- Question bank with difficulty/domain/status
- Randomized question and choice order
- Optional assessment timer
- Autosave of in-progress answers
- Automatic scoring and domain scoring
- Basic / Intermediate / Advanced classification
- Mastered and improvement areas
- Intervention recommendations and completion tracking
- Student progress analytics
- Teacher dashboard and student directory
- Class analytics and heatmap
- Individual reports
- CSV export and printable report
- Notification/announcement structure
- Retake authorization
- Assessment scheduling
- Audit logs
- Account security/RLS policies
- Responsive ICT-themed UI
- Dark mode and accessibility controls
- Lightweight animated login background

## Important
This is a deployable application foundation, not a pretend/static demo. It requires a real Supabase project and environment configuration before public deployment.

Do not place an administrator password in frontend code. Create the first admin securely in Supabase and assign the admin role using the SQL instructions.

## Setup
1. Create a Supabase project.
2. Run `supabase.sql` in Supabase SQL Editor.
3. Enable Email/Password authentication.
4. Create a `.env`/configuration containing your Supabase URL and anon key if using a bundler, or replace the placeholders in `app.js` for the simple static deployment.
5. Deploy the folder to a static host such as Netlify, Vercel static hosting, GitHub Pages-compatible hosting, or your school server.
6. For production, configure a custom domain such as your chosen CLMIS domain.
7. Create the first administrator from the Supabase Auth dashboard, then assign the admin role in the database.
8. Never expose a service-role key in browser code.

## Architecture
Frontend:
- index.html
- styles.css
- app.js

Backend:
- Supabase Auth
- PostgreSQL
- Row Level Security
- Database functions/triggers
- Storage can be added for intervention resources

The application uses real database operations when Supabase is configured. The UI intentionally does not use hard-coded student performance as live data.
