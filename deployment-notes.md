# CLMIS Deployment Notes

## Before public launch
- Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`.
- Configure Supabase Auth email confirmation and password reset redirect URLs.
- Run the SQL schema.
- Create teacher/admin users securely.
- Never expose a service-role key.
- Review and test Row Level Security with separate student, teacher, and admin accounts.
- Add your actual school logo and CLMIS logo.
- Replace the placeholder custom domain with the domain you own.
- Configure HTTPS.
- Test mobile and desktop layouts.
- Test assessment submission, timer expiry, autosave, retake authorization, exports, and audit logging.
- Review the Privacy Notice with the school/data-protection officer before collecting real student data.
