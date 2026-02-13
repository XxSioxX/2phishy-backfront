#!/usr/bin/env python3
"""
Script to update the superadmin user role to super-admin.
"""

import sys
import os
from sqlalchemy.orm import Session

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.core.database_postgres import get_db, init_db
from app.modules.user.models.user import User, UserRole

def update_superadmin_role():
    """Update the superadmin user role to super-admin"""
    print("Updating Super Admin Role")
    print("=" * 50)

    # Initialize database
    init_db()

    # Get database session
    db = next(get_db())

    # Find the user with username 'superadmin'
    user = db.query(User).filter(User.username == "superadmin").first()
    if not user:
        print("Superadmin user not found!")
        return

    print(f"Found user: {user.username}, current role: {user.role.value}")

    if user.role == UserRole.SUPER_ADMIN:
        print("User already has super-admin role.")
        return

    # Update role
    user.role = UserRole.SUPER_ADMIN
    db.commit()
    db.refresh(user)

    print(f"Role updated to: {user.role.value}")
    print("=" * 50)

if __name__ == "__main__":
    update_superadmin_role()
