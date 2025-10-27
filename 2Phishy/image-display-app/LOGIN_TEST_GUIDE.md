# Login Page Testing Guide

## 🧪 **Testing the Fixed Login System**

### **What We Fixed:**

1. **Authentication Integration**: Added proper JWT token handling
2. **Error Handling**: Improved error messages and user feedback
3. **User Context**: Created AuthContext for global user state management
4. **Role-Based Navigation**: Users are redirected based on their role
5. **API Integration**: Fixed API endpoints to match backend structure
6. **Navbar Integration**: Added logout functionality and user display

### **How to Test:**

#### **Step 1: Start the Servers**
```bash
# Backend (in one terminal)
cd phishy-backend-main/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (in another terminal)
cd 2Phishy/image-display-app
npm start
```

#### **Step 2: Test Registration**
1. Go to `http://localhost:3000/register`
2. Create a new user account
3. Should redirect to login page

#### **Step 3: Test Login**
1. Go to `http://localhost:3000/login`
2. Enter credentials from Step 2
3. **Expected Results:**
   - ✅ **Student User**: Redirected to `/` (home page)
   - ✅ **Admin User**: Redirected to `/admin` (admin panel)
   - ✅ **Token stored**: Check browser DevTools > Application > Local Storage
   - ✅ **User info displayed**: Navbar shows username and role

#### **Step 4: Test Authentication State**
1. **Navbar should show:**
   - Username instead of "Guest"
   - User role in parentheses (e.g., "john (student)")
   - Logout button instead of Login link

2. **Protected routes should work:**
   - `/users` - Should load user data (if admin) or show 403 (if student)
   - `/admin` - Should work for admins, 403 for students

#### **Step 5: Test Logout**
1. Click "Logout" button in navbar
2. Should redirect to home page
3. Navbar should show "Guest" and "Login" link
4. Local storage should be cleared

### **Expected API Responses:**

#### **Successful Login:**
```json
{
  "user": {
    "userid": "uuid-here",
    "username": "testuser",
    "email": "test@example.com",
    "role": "student",
    "account_status": "active"
  },
  "access_token": "jwt-token-here",
  "token_type": "bearer",
  "message": "Login successful"
}
```

#### **Failed Login (401):**
```json
{
  "detail": "Invalid username or password"
}
```

### **Troubleshooting:**

#### **If Login Fails:**
1. **Check Backend**: Ensure backend is running on port 8000
2. **Check Network**: Open DevTools > Network tab to see API calls
3. **Check Console**: Look for error messages in browser console
4. **Check Backend Logs**: Look at terminal running the backend

#### **If 403 Errors:**
- This is **expected behavior** for role-based routing!
- Students can't access admin endpoints
- This proves our security is working

#### **If Token Issues:**
1. Check Local Storage in DevTools
2. Verify token is being sent in API requests
3. Check Authorization header format: `Bearer <token>`

### **Creating Test Users:**

#### **Regular User (Student):**
```bash
curl -X POST "http://localhost:8000/users/register" \
-H "Content-Type: application/json" \
-d '{"username": "student", "email": "student@test.com", "password": "password123", "role": "student"}'
```

#### **Admin User:**
```bash
curl -X POST "http://localhost:8000/users/register" \
-H "Content-Type: application/json" \
-d '{"username": "admin", "email": "admin@test.com", "password": "admin123", "role": "admin"}'
```

### **Success Indicators:**

✅ **Login page loads without errors**
✅ **Registration works and redirects to login**
✅ **Login works and stores token**
✅ **User info appears in navbar**
✅ **Role-based navigation works**
✅ **Logout clears session**
✅ **Protected routes respect user roles**
✅ **Error messages are user-friendly**

### **Next Steps:**

1. **Test with Postman**: Use the provided Postman collection
2. **Test Role Switching**: Login as different user types
3. **Test Edge Cases**: Invalid credentials, expired tokens, etc.
4. **Frontend Integration**: Test all pages with authentication

The login system is now fully integrated with the role-based routing backend!
