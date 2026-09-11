import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)  # null for Google-only accounts
    google_id = Column(String, unique=True, nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    reset_tokens = relationship(
        "PasswordResetToken", back_populates="user", cascade="all, delete-orphan"
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="reset_tokens")


class Person(Base):
    """A person in a user's family tree. Not a login account — just a record."""

    __tablename__ = "people"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    gender = Column(String, nullable=True)  # "male" | "female" | "other" | null
    date_of_birth = Column(Date, nullable=True)
    date_of_death = Column(Date, nullable=True)
    place_of_birth = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class FamilyUnit(Base):
    """
    A GEDCOM-style family unit: up to two partners plus their children.
    This is what relationships are built from — 'Ramesh is Father of Varun'
    becomes: a FamilyUnit with partner1=Ramesh, and Varun as a FamilyChild.
    Modeling it this way (instead of raw Father-of/Sibling-of pairs) makes
    siblings, spouses, and ancestor/descendant lookups fall out for free.
    """

    __tablename__ = "family_units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    partner1_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=True)
    partner2_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=True)
    # Keeps remarriage/separation information on the partnership, not on a
    # person, because one person can have several distinct partnerships.
    relationship_status = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    children = relationship(
        "FamilyChild", back_populates="family_unit", cascade="all, delete-orphan"
    )


class FamilyChild(Base):
    """Join row: one child belongs to one family unit."""

    __tablename__ = "family_children"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_unit_id = Column(
        UUID(as_uuid=True), ForeignKey("family_units.id"), nullable=False, index=True
    )
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=False, index=True)
    # Describes this child's relationship to this particular parent family.
    # A person may have several FamilyChild rows for biological, adoptive,
    # step, half-sibling, or otherwise unknown family records.
    relationship_type = Column(String, nullable=True)

    family_unit = relationship("FamilyUnit", back_populates="children")
