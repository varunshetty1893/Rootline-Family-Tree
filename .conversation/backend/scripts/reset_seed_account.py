"""Remove only seeded family-tree data for one existing test account.

The user record, credentials, password reset records, and every other user's
data are deliberately left untouched.
"""

import argparse
import sys
from pathlib import Path

# Allow `python scripts/reset_seed_account.py` from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models
from app.database import SessionLocal


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default="rootline.seed@example.com")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == args.email).first()
        if not user:
            raise SystemExit(f"No user found for {args.email}")

        family_unit_ids = [
            row[0]
            for row in db.query(models.FamilyUnit.id)
            .filter(models.FamilyUnit.owner_id == user.id)
            .all()
        ]
        people_count = db.query(models.Person).filter(models.Person.owner_id == user.id).count()
        child_count = 0
        if family_unit_ids:
            child_count = (
                db.query(models.FamilyChild)
                .filter(models.FamilyChild.family_unit_id.in_(family_unit_ids))
                .delete(synchronize_session=False)
            )
            db.query(models.FamilyUnit).filter(models.FamilyUnit.id.in_(family_unit_ids)).delete(
                synchronize_session=False
            )
        db.query(models.Person).filter(models.Person.owner_id == user.id).delete(
            synchronize_session=False
        )
        db.commit()
        print(
            f"Removed {people_count} people, {len(family_unit_ids)} family units, and "
            f"{child_count} family-child links for {args.email}. The account was retained."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
