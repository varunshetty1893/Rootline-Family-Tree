import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


# ── People ───────────────────────────────────────────────────────────────
class RelationType(str, Enum):
    father = "father"
    mother = "mother"
    parent = "parent"
    spouse = "spouse"
    child = "child"
    sibling = "sibling"


class PersonBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    gender: str | None = None
    date_of_birth: date | None = None
    date_of_death: date | None = None
    place_of_birth: str | None = None
    occupation: str | None = None
    bio: str | None = None
    photo_url: str | None = None


class PersonCreate(PersonBase):
    # Optional: connect this new person to someone already in the tree,
    # e.g. relation_type="father", related_to_id=<Varun's id> means
    # "this new person is Varun's father".
    relation_type: RelationType | None = None
    related_to_id: uuid.UUID | None = None
    # Optional family unit chosen by the relationship-aware add flow. This is
    # important for people with multiple parent families or partners.
    family_id: uuid.UUID | None = None
    # Used when a child is being added with an existing person who is not yet
    # linked as the selected person's partner.
    partner_id: uuid.UUID | None = None
    family_relationship: str | None = None  # biological | adoptive | step | unknown
    partner_status: str | None = None  # partner | married | separated | divorced | unknown
    new_family: bool = False


class PersonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    gender: str | None = None
    date_of_birth: date | None = None
    date_of_death: date | None = None
    place_of_birth: str | None = None
    occupation: str | None = None
    bio: str | None = None
    photo_url: str | None = None


class FamilyOption(BaseModel):
    id: uuid.UUID
    partner_ids: list[uuid.UUID] = []
    child_ids: list[uuid.UUID] = []
    relationship_type: str | None = None
    relationship_status: str | None = None


class PersonOut(PersonBase):
    id: uuid.UUID
    created_at: datetime
    parent_ids: list[uuid.UUID] = []
    spouse_ids: list[uuid.UUID] = []
    # All family units are returned so the UI can ask instead of guessing.
    parent_families: list[FamilyOption] = []
    partner_families: list[FamilyOption] = []

    class Config:
        from_attributes = True
