"""One-table bootstrap.

Plan A keeps only the ``users`` table in Postgres, so there is no migration chain to
run on deploy — the table is created if missing and the admin is seeded from
``ADMIN_EMAIL`` / ``ADMIN_PASSWORD`` at startup. Alembic stays in the repo for local
use and for when a second table arrives.
"""

from __future__ import annotations

import logging

from app.auth.security import hash_password
from app.config import settings
from app.db.session import engine
from app.models.user import User

log = logging.getLogger("swing.bootstrap")


def bootstrap_db() -> None:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:  # noqa: BLE001 - surface it but do not crash the whole app
        log.exception("could not ensure the users table exists")
        return

    email = settings.admin_email.strip().lower()
    password = settings.admin_password
    if not (email and password):
        log.info("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed")
        return

    from sqlalchemy import select
    from sqlalchemy.orm import Session

    with Session(engine) as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            db.add(User(email=email, password_hash=hash_password(password), is_active=True))
            log.info("admin created: %s", email)
        else:
            user.password_hash = hash_password(password)
            user.is_active = True
            log.info("admin password refreshed: %s", email)
        db.commit()
