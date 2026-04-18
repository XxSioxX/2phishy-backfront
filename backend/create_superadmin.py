#!/usr/bin/env python3
"""Create or promote a super-admin user for development environments."""

import argparse
import bcrypt

from app.core.database_postgres import get_db, init_db
from app.modules.user.models.user import AccountStatus, User, UserRole
from app.modules.user.schemas.schemas import UserCreate
from app.modules.user.services.services import create_user


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or promote a super-admin user")
    parser.add_argument("--username", required=True, help="Super-admin username")
    parser.add_argument("--email", required=True, help="Super-admin email")
    parser.add_argument("--password", required=True, help="Super-admin password")
    return parser.parse_args()


def create_or_promote_superadmin(username: str, email: str, password: str) -> int:
    init_db()
    db = next(get_db())

    try:
        user = db.query(User).filter((User.username == username) | (User.email == email.lower())).first()

        if user is None:
            user_data = UserCreate(
                username=username,
                email=email.lower(),
                password=password,
                role=UserRole.SUPER_ADMIN,
            )
            user = create_user(db, user_data)
            print(f"Created super-admin user: {user.username} ({user.email})")
            return 0

        changed = False

        if user.role != UserRole.SUPER_ADMIN:
            user.role = UserRole.SUPER_ADMIN
            changed = True

        if user.account_status != AccountStatus.ACTIVE:
            user.account_status = AccountStatus.ACTIVE
            changed = True

        new_password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user.password = new_password_hash
        changed = True

        if changed:
            db.commit()
            db.refresh(user)
            print(f"Updated existing user to super-admin: {user.username} ({user.email})")
        else:
            print(f"User already configured as super-admin: {user.username} ({user.email})")

        return 0
    except Exception as exc:
        db.rollback()
        print(f"Failed to create/promote super-admin: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    arguments = parse_args()
    raise SystemExit(
        create_or_promote_superadmin(
            username=arguments.username,
            email=arguments.email,
            password=arguments.password,
        )
    )
