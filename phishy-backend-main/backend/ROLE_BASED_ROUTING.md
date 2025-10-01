# Role-Based Routing System

This document describes the role-based access control (RBAC) system implemented in the Phishy Backend API.

## User Roles

The system defines three user roles:

1. **STUDENT** - Default role for regular users
2. **ADMIN** - Administrative users with elevated privileges
3. **SUPER_ADMIN** - Highest level administrators with full system access

## Authentication & Authorization

### JWT Token System
- Users authenticate with username/password
- JWT tokens are issued upon successful authentication
- Tokens contain user ID and expire after 30 minutes
- All protected routes require valid JWT tokens in the Authorization header

### Role-Based Dependencies
The system provides several dependency functions for route protection:

- `get_current_active_user()` - Requires valid authentication
- `require_admin_role()` - Requires admin or super-admin role
- `require_super_admin_role()` - Requires super-admin role only
- `require_role(role)` - Factory function for custom role requirements

## API Endpoints

### Public Endpoints (No Authentication Required)
- `POST /users/register` - User registration
- `POST /users/login` - User authentication

### User Endpoints (Authentication Required)
- `GET /users/me/` - Get current user profile
- `PUT /users/me/` - Update own profile (username, email only)
- `GET /users/{user_id}` - Get specific user (if admin)

### Admin Endpoints (Admin/Super-Admin Required)
- `GET /users/` - List all users
- `PUT /users/{user_id}` - Update any user
- `DELETE /users/{user_id}` - Delete any user (except self)

### Admin Panel Endpoints (Admin/Super-Admin Required)
- `GET /admin/stats` - Get user statistics
- `GET /admin/users` - List all users with full details
- `GET /admin/users/role/{role}` - Get users by role
- `GET /admin/users/status/{status}` - Get users by account status
- `GET /admin/users/{user_id}` - Get specific user details
- `PUT /admin/users/{user_id}` - Update user information
- `PATCH /admin/users/{user_id}/role/{new_role}` - Change user role
- `PATCH /admin/users/{user_id}/status/{new_status}` - Change account status
- `DELETE /admin/users/{user_id}` - Delete user
- `GET /admin/my-role` - Get current admin's role

### Super Admin Only Endpoints
- `POST /admin/users/create-admin` - Create new admin user (planned)
- `GET /admin/super-admin/stats` - Get detailed system statistics

## Security Features

### Role Hierarchy
- Super-admins can perform all admin actions
- Admins can manage users but cannot create super-admins
- Users cannot modify their own role or account status
- Users cannot delete their own accounts

### Account Status Management
- **ACTIVE** - Normal account status
- **INACTIVE** - Account disabled
- **SUSPENDED** - Account temporarily suspended

### Data Protection
- Passwords are hashed using secure algorithms
- Sensitive operations are logged
- Role changes are tracked with admin attribution
- Self-modification of critical fields is prevented

## Usage Examples

### Creating a User with Specific Role
```python
# During registration, you can specify a role
user_data = {
    "username": "newuser",
    "email": "user@example.com",
    "password": "securepassword",
    "role": "student"  # or "admin" (only super-admins can create super-admins)
}
```

### Admin Operations
```python
# Change user role (admin only)
PATCH /admin/users/{user_id}/role/admin

# Suspend user account
PATCH /admin/users/{user_id}/status/suspended

# Get user statistics
GET /admin/stats
```

### User Self-Service
```python
# Update own profile
PUT /users/me/
{
    "username": "newusername",
    "email": "newemail@example.com"
}
```

## Database Schema

### User Model
```python
class User(Base):
    userid: str (Primary Key)
    username: str (Unique)
    email: str (Unique)
    password: str (Hashed)
    created_at: datetime
    last_login: datetime
    account_status: AccountStatus (ACTIVE/INACTIVE/SUSPENDED)
    role: UserRole (STUDENT/ADMIN/SUPER_ADMIN)
```

## Error Handling

The system provides clear error messages for various scenarios:

- `401 Unauthorized` - Invalid or missing authentication
- `403 Forbidden` - Insufficient role permissions
- `400 Bad Request` - Invalid operation (e.g., self-deletion)
- `404 Not Found` - User not found
- `500 Internal Server Error` - System errors

## Logging

All administrative actions are logged with:
- Admin user identification
- Target user identification
- Action performed
- Timestamp
- Success/failure status

## Future Enhancements

1. **Permission System** - Granular permissions within roles
2. **Audit Trail** - Complete history of all user modifications
3. **Role Templates** - Predefined role configurations
4. **Bulk Operations** - Mass user management capabilities
5. **API Rate Limiting** - Prevent abuse of admin endpoints

## Testing the System

1. Register a new user (defaults to STUDENT role)
2. Login to get JWT token
3. Use token in Authorization header for protected routes
4. Test role-based access with different user types
5. Verify admin operations work correctly
6. Confirm security restrictions are enforced

## Security Best Practices

1. Always use HTTPS in production
2. Rotate JWT secrets regularly
3. Monitor admin actions through logs
4. Implement account lockout after failed attempts
5. Regular security audits of role assignments
6. Backup user data before bulk operations


