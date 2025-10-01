#!/usr/bin/env python3
"""
Script to automatically create the first admin user for the Phishy Backend system.
This version creates a default super-admin user without requiring interactive input.

Usage:
    python create_admin_auto.py
"""

import sys
import os
from sqlalchemy.orm import Session

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.core.database import get_db, init_db
from app.modules.user.models.user import User, UserRole
from app.modules.user.schemas.schemas import UserCreate
from app.modules.user.services.services import create_user
from app.utils.password import get_password_hash

def create_super_admin():
    """Create the first super admin user with default credentials"""
    print("Creating Super Admin User for Phishy Backend")
    print("=" * 50)
    
    # Initialize database
    init_db()
    
    # Get database session
    db = next(get_db())
    
    # Check if any super admins already exist
    existing_super_admin = db.query(User).filter(User.role == UserRole.SUPER_ADMIN).first()
    if existing_super_admin:
        print(f"Super admin already exists: {existing_super_admin.username}")
        print("You can use the existing super admin or create additional admins through the API.")
        return
    
    # Default super admin credentials
    username = "admin"
    email = "admin@phishy.com"
    password = "admin123"
    
    # Check if username or email already exists
    existing_user = db.query(User).filter(
        (User.username == username) | (User.email == email)
    ).first()
    
    if existing_user:
        print(f"Error: User with username '{username}' or email '{email}' already exists!")
        print("Please delete the existing user or use different credentials.")
        return
    
    try:
        # Create super admin user
        user_data = UserCreate(
            username=username,
            email=email,
            password=password,
            role=UserRole.SUPER_ADMIN
        )
        
        super_admin = create_user(db, user_data)
        
        print("\n" + "=" * 50)
        print("SUPER ADMIN CREATED SUCCESSFULLY!")
        print("=" * 50)
        print(f"User ID: {super_admin.userid}")
        print(f"Username: {super_admin.username}")
        print(f"Email: {super_admin.email}")
        print(f"Role: {super_admin.role.value}")
        print(f"Account Status: {super_admin.account_status.value}")
        print("=" * 50)
        print("\nDEFAULT CREDENTIALS:")
        print(f"Username: {username}")
        print(f"Password: {password}")
        print("=" * 50)
        print("\nYou can now:")
        print("1. Login with these credentials to get a JWT token")
        print("2. Use the admin endpoints to manage other users")
        print("3. Create additional admin users through the API")
        print("\nAdmin endpoints are available at: /admin/*")
        print("\n⚠️  IMPORTANT: Change the default password after first login!")
        
    except Exception as e:
        print(f"Error creating super admin: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_super_admin()


