import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/people", tags=["people"])


def _get_owned_person(person_id: uuid.UUID, user: models.User, db: Session) -> models.Person:
    person = (
        db.query(models.Person)
        .filter(models.Person.id == person_id, models.Person.owner_id == user.id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return person


def _family_option(fu: models.FamilyUnit, child_id: uuid.UUID | None = None) -> schemas.FamilyOption:
    child_row = next((child for child in fu.children if child.person_id == child_id), None)
    return schemas.FamilyOption(
        id=fu.id,
        partner_ids=[pid for pid in (fu.partner1_id, fu.partner2_id) if pid],
        child_ids=[child.person_id for child in fu.children],
        relationship_type=child_row.relationship_type if child_row else None,
        relationship_status=fu.relationship_status,
    )


def _serialize_person(person: models.Person, db: Session) -> schemas.PersonOut:
    """Derives graph relationships and all family choices from Family Units."""
    child_rows = (
        db.query(models.FamilyChild)
        .filter(models.FamilyChild.person_id == person.id)
        .all()
    )
    parent_families: list[schemas.FamilyOption] = []
    parent_ids: list[uuid.UUID] = []
    for child_row in child_rows:
        fu = db.get(models.FamilyUnit, child_row.family_unit_id)
        if not fu:
            continue
        parent_families.append(_family_option(fu, person.id))
        parent_ids.extend(pid for pid in (fu.partner1_id, fu.partner2_id) if pid)
    parent_ids = list(dict.fromkeys(parent_ids))

    spouse_ids: list[uuid.UUID] = []
    spouse_units = (
        db.query(models.FamilyUnit)
        .filter(
            or_(
                models.FamilyUnit.partner1_id == person.id,
                models.FamilyUnit.partner2_id == person.id,
            )
        )
        .all()
    )
    for fu in spouse_units:
        other = fu.partner2_id if fu.partner1_id == person.id else fu.partner1_id
        if other:
            spouse_ids.append(other)

    partner_families = [_family_option(fu) for fu in spouse_units]

    return schemas.PersonOut(
        id=person.id,
        name=person.name,
        gender=person.gender,
        date_of_birth=person.date_of_birth,
        date_of_death=person.date_of_death,
        place_of_birth=person.place_of_birth,
        occupation=person.occupation,
        bio=person.bio,
        photo_url=person.photo_url,
        created_at=person.created_at,
        parent_ids=parent_ids,
        spouse_ids=spouse_ids,
        parent_families=parent_families,
        partner_families=partner_families,
    )


def _apply_relation(
    new_person: models.Person,
    relation_type: schemas.RelationType | None,
    related_to_id: uuid.UUID | None,
    family_id: uuid.UUID | None,
    partner_id: uuid.UUID | None,
    family_relationship: str | None,
    partner_status: str | None,
    new_family: bool,
    owner_id: uuid.UUID,
    db: Session,
) -> None:
    """Wires a newly created person into the family graph via Family Units."""
    if relation_type is None or related_to_id is None:
        return

    related = (
        db.query(models.Person)
        .filter(models.Person.id == related_to_id, models.Person.owner_id == owner_id)
        .first()
    )
    if not related:
        raise HTTPException(status_code=400, detail="The person you're relating to wasn't found")

    selected_family = None
    if family_id:
        selected_family = (
            db.query(models.FamilyUnit)
            .filter(models.FamilyUnit.id == family_id, models.FamilyUnit.owner_id == owner_id)
            .first()
        )
        if not selected_family:
            raise HTTPException(status_code=400, detail="The selected family was not found")

    selected_partner = None
    if partner_id:
        selected_partner = (
            db.query(models.Person)
            .filter(models.Person.id == partner_id, models.Person.owner_id == owner_id)
            .first()
        )
        if not selected_partner:
            raise HTTPException(status_code=400, detail="The selected partner was not found")
        if selected_partner.id == related.id:
            raise HTTPException(status_code=400, detail="A person cannot be their own partner")

    if relation_type in (
        schemas.RelationType.father,
        schemas.RelationType.mother,
        schemas.RelationType.parent,
    ):
        # new_person becomes a parent of `related`.
        if selected_family:
            fu = selected_family
            related_child = next((child for child in fu.children if child.person_id == related.id), None)
            if not related_child:
                raise HTTPException(status_code=400, detail="That family does not belong to the selected person")
            if family_relationship and not related_child.relationship_type:
                related_child.relationship_type = family_relationship
        elif not new_family:
            child_row = (
                db.query(models.FamilyChild)
                .filter(models.FamilyChild.person_id == related.id)
                .first()
            )
            if child_row:
                fu = db.get(models.FamilyUnit, child_row.family_unit_id)
            else:
                fu = models.FamilyUnit(owner_id=owner_id)
                db.add(fu)
                db.flush()
                db.add(
                    models.FamilyChild(
                        family_unit_id=fu.id,
                        person_id=related.id,
                        relationship_type=family_relationship or "unknown",
                    )
                )
        else:
            fu = models.FamilyUnit(owner_id=owner_id)
            db.add(fu)
            db.flush()
            db.add(
                models.FamilyChild(
                    family_unit_id=fu.id,
                    person_id=related.id,
                    relationship_type=family_relationship or "unknown",
                )
            )

        if fu.partner1_id is None:
            fu.partner1_id = new_person.id
        elif fu.partner2_id is None:
            fu.partner2_id = new_person.id
        else:
            raise HTTPException(
                status_code=400, detail=f"{related.name} already has two parents recorded"
            )

    elif relation_type == schemas.RelationType.spouse:
        fu = models.FamilyUnit(
            owner_id=owner_id,
            partner1_id=related.id,
            partner2_id=new_person.id,
            relationship_status=partner_status or "partner",
        )
        db.add(fu)

    elif relation_type == schemas.RelationType.child:
        # new_person becomes a child of the explicitly selected family. The
        # client chooses this after asking "same or different partner".
        fu = selected_family
        if fu and related.id not in (fu.partner1_id, fu.partner2_id):
            raise HTTPException(status_code=400, detail="That family does not belong to the selected person")
        if not fu and selected_partner:
            fu = models.FamilyUnit(
                owner_id=owner_id,
                partner1_id=related.id,
                partner2_id=selected_partner.id,
                relationship_status=partner_status or "partner",
            )
            db.add(fu)
            db.flush()
        if not fu:
            fu = models.FamilyUnit(
                owner_id=owner_id,
                partner1_id=related.id,
                relationship_status=partner_status or "partner",
            )
            db.add(fu)
            db.flush()
        db.add(
            models.FamilyChild(
                family_unit_id=fu.id,
                person_id=new_person.id,
                relationship_type=family_relationship or "unknown",
            )
        )

    elif relation_type == schemas.RelationType.sibling:
        # new_person becomes another child in `related`'s parent family unit
        # selected explicitly when the person has more than one family.
        if selected_family:
            fu = selected_family
            if not any(child.person_id == related.id for child in fu.children):
                raise HTTPException(status_code=400, detail="That family does not belong to the selected person")
        elif not new_family:
            child_row = (
                db.query(models.FamilyChild)
                .filter(models.FamilyChild.person_id == related.id)
                .first()
            )
            if child_row:
                fu = db.get(models.FamilyUnit, child_row.family_unit_id)
            else:
                fu = models.FamilyUnit(owner_id=owner_id)
                db.add(fu)
                db.flush()
                db.add(
                    models.FamilyChild(
                        family_unit_id=fu.id,
                        person_id=related.id,
                        relationship_type=family_relationship or "unknown",
                    )
                )
        if not selected_family and new_family:
            fu = models.FamilyUnit(owner_id=owner_id)
            db.add(fu)
            db.flush()
            db.add(
                models.FamilyChild(
                    family_unit_id=fu.id,
                    person_id=related.id,
                    relationship_type=family_relationship or "unknown",
                )
            )
        db.add(
            models.FamilyChild(
                family_unit_id=fu.id,
                person_id=new_person.id,
                relationship_type=family_relationship or "unknown",
            )
        )


@router.get("", response_model=list[schemas.PersonOut])
def list_people(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    people = (
        db.query(models.Person)
        .filter(models.Person.owner_id == current_user.id)
        .order_by(models.Person.created_at)
        .all()
    )
    return [_serialize_person(p, db) for p in people]


@router.post("", response_model=schemas.PersonOut, status_code=status.HTTP_201_CREATED)
def create_person(
    payload: schemas.PersonCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = payload.model_dump(
        exclude={
            "relation_type",
            "related_to_id",
            "family_id",
            "partner_id",
            "family_relationship",
            "partner_status",
            "new_family",
        }
    )
    person = models.Person(owner_id=current_user.id, **data)
    db.add(person)
    db.flush()  # person.id is available now, without committing yet

    _apply_relation(
        person,
        payload.relation_type,
        payload.related_to_id,
        payload.family_id,
        payload.partner_id,
        payload.family_relationship,
        payload.partner_status,
        payload.new_family,
        current_user.id,
        db,
    )

    db.commit()
    db.refresh(person)
    return _serialize_person(person, db)


@router.get("/{person_id}", response_model=schemas.PersonOut)
def get_person(
    person_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    person = _get_owned_person(person_id, current_user, db)
    return _serialize_person(person, db)


@router.patch("/{person_id}", response_model=schemas.PersonOut)
def update_person(
    person_id: uuid.UUID,
    payload: schemas.PersonUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    person = _get_owned_person(person_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    db.commit()
    db.refresh(person)
    return _serialize_person(person, db)


@router.delete("/{person_id}", response_model=schemas.MessageResponse)
def delete_person(
    person_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    person = _get_owned_person(person_id, current_user, db)

    # Clean up any Family Unit rows that reference this person, so deleting
    # someone doesn't leave dangling parent/spouse/child references behind.
    db.query(models.FamilyChild).filter(models.FamilyChild.person_id == person_id).delete()
    for fu in (
        db.query(models.FamilyUnit)
        .filter(
            or_(
                models.FamilyUnit.partner1_id == person_id,
                models.FamilyUnit.partner2_id == person_id,
            )
        )
        .all()
    ):
        if fu.partner1_id == person_id:
            fu.partner1_id = None
        if fu.partner2_id == person_id:
            fu.partner2_id = None

    db.delete(person)
    db.commit()
    return schemas.MessageResponse(message="Person removed.")
