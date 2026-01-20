# Task: Fix 405 Method Not Allowed Error for User Registration

## Issue
- Frontend was sending POST request to `/users/` for user registration
- Backend only supports GET on `/users/` (list users) and POST on `/users/register` (register user)
- Result: 405 Method Not Allowed error

## Solution
- Updated frontend API service to use `/users/register` endpoint for registration instead of `/users/`

## Changes Made
- [x] Modified `2Phishy/image-display-app/src/services/api.ts` - Changed register function URL from `/users/` to `/users/register`

## Testing
- Registration should now work without 405 error
- Backend logs show successful registration requests to `/users/register`
