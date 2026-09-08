from __future__ import annotations

import logging

from sqlalchemy import select

from app.auth.security import hash_password
from app.config import settings
from app.db.session import SessionLocal
from app.models import User

log = logging.getLogger("swing.auth.seed")


def run(email: str | None = None, password: str | None = None) -> None:
    email = (email or settings.admin_email).strip().lower()
    password = password or settings.admin_password
    if not email or not password:
        raise SystemExit("Set ADMIN_EMAIL and ADMIN_PASSWORD (env or .env) first.")

    db = SessionLocal()
    try:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            db.add(User(email=email, password_hash=hash_password(password), is_active=True))
            action = "created"
        else:
            user.password_hash = hash_password(password)
            user.is_active = True
            action = "updated"
        db.commit()
        log.info("admin %s: %s", action, email)
        print(f"admin {action}: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
