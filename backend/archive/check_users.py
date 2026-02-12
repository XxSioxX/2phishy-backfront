#!/usr/bin/env python3
"""
Script to check existing users in the database.
"""

import sys
import os
from sqlalchemy.orm import Session

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.core.database_postgres import get_db, init_db
from app.modules.user.models.user import User

def check_users():
    """Check and display all users in the database"""
    print("Checking Users in Phishy Database")
    print("=" * 50)

    # Initialize database
    init_db()

    # Get database session
    db = next(get_db())

    try:
        # Get all users
        users = db.query(User).all()

        if not users:
            print("No users found in the database.")
            return

        print(f"Found {len(users)} user(s):")
        print("-" * 50)

        for user in users:
            print(f"User ID: {user.userid}")
            print(f"Username: {user.username}")
            print(f"Email: {user.email}")
            print(f"Role: {user.role.value}")
            print(f"Account Status: {user.account_status.value}")
            print(f"Created At: {user.created_at}")
            print("-" * 30)

    except Exception as e:
        print(f"Error checking users: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    check_users()
