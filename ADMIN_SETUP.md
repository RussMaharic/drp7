# Admin Credentials Setup

## Overview
The admin login system now uses environment variables for better security. Instead of hardcoded credentials, you can configure the admin username and password through environment variables.

## Environment Variables

### Required Variables
Create a `.env.local` file in the root directory of your project with the following variables:

```env
# Admin Credentials
NEXT_PUBLIC_ADMIN_USERNAME=your_admin_username
NEXT_PUBLIC_ADMIN_PASSWORD=your_admin_password
```

### Example Configuration
```env
# Admin Credentials
NEXT_PUBLIC_ADMIN_USERNAME=admin
NEXT_PUBLIC_ADMIN_PASSWORD=secure_password_123

# Other existing environment variables...
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## How to Change Admin Credentials

1. **Create or edit `.env.local` file** in the project root
2. **Add or update the admin variables:**
   ```env
   NEXT_PUBLIC_ADMIN_USERNAME=your_new_username
   NEXT_PUBLIC_ADMIN_PASSWORD=your_new_password
   ```
3. **Restart your development server** for changes to take effect

## Security Notes

- The `.env.local` file is automatically ignored by Git (see `.gitignore`)
- Never commit your actual credentials to version control
- Use strong, unique passwords for production environments
- Consider implementing proper authentication with database storage for production use

## Default Fallback
If environment variables are not set, the system will fall back to:
- Username: `admin`
- Password: `admin123`

## Access Admin Panel
Navigate to `/login/admin` to access the admin login page with your configured credentials. 