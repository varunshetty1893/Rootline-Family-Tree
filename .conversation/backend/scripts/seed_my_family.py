"""
Populates a running Rootline instance with the real family from the spec
(section 26), using the actual HTTP API — the same endpoints the React app
calls — so every relation goes through the same validation the app itself
uses. Nothing here talks to the database directly.

Usage:
    cd backend
    pip install requests          # if you don't already have it
    python scripts/seed_my_family.py --base-url http://localhost:8000

By default it registers a fresh throwaway account (rootline.seed@example.com)
so it never touches your real login's data. Pass --email/--password to seed
into an account you already have instead.

Notes on the data, on purpose:
  * Two different people are both named "Babu" in real life (Varun's father,
    and separately Rajani's husband) — they're created as two separate
    person records here, exactly as section 20 of the spec requires. Look
    for BABU_SR and BABU_RAJANI_HUSBAND below; never merged by name.
  * "Deceased" people (Munna, Vaibov, Bhaskar, DDP) have no real date of
    death available, so date_of_death is left blank and a "(deceased)" note
    is put in their bio instead — this script won't invent a death date.
  * A few spouses/children in the source spec have no real name given
    ("Bhavana's husband", "1 Kid", etc.) — those are seeded using that
    literal placeholder text so they're visibly placeholders, not names.
"""

import argparse
import sys

import httpx


def register_or_login(session, base_url, name, email, password):
    resp = session.post(
        f"{base_url}/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    if resp.status_code == 201:
        return resp.json()["access_token"]

    if resp.status_code == 400:  # already exists — log in instead
        resp = session.post(f"{base_url}/auth/login", json={"email": email, "password": password})
        resp.raise_for_status()
        return resp.json()["access_token"]

    resp.raise_for_status()


class FamilyBuilder:
    def __init__(self, session, base_url, token):
        self.session = session
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}
        self.registry = {}  # short key -> person id, for people you'll reference again

    def _create(self, name, relation_type=None, related_to_key=None, **fields):
        payload = {"name": name, **fields}
        if relation_type:
            payload["relation_type"] = relation_type
            payload["related_to_id"] = self.registry[related_to_key]
        resp = self.session.post(f"{self.base_url}/people", json=payload, headers=self.headers)
        if resp.status_code != 201:
            raise RuntimeError(f"Failed creating {name}: {resp.status_code} {resp.text}")
        return resp.json()["id"]

    def root(self, key, name, **fields):
        """First person overall, or the start of a new disconnected branch."""
        self.registry[key] = self._create(name, **fields)
        return self.registry[key]

    def spouse(self, key, of_key, name, **fields):
        """`name` becomes the spouse of the person at `of_key`."""
        self.registry[key] = self._create(name, relation_type="spouse", related_to_key=of_key, **fields)
        return self.registry[key]

    def child(self, key, of_key, name, **fields):
        """`name` becomes a child of the person at `of_key` (and their spouse,
        if any — the API attaches the child to that couple's shared family
        unit automatically)."""
        self.registry[key] = self._create(name, relation_type="child", related_to_key=of_key, **fields)
        return self.registry[key]


def build(fb: FamilyBuilder):
    DECEASED = {"bio": "(deceased)"}

    # ── Mutthayya + Gulabi and their side ──────────────────────────────
    fb.root("mutthayya", "Mutthayya", gender="male")
    fb.spouse("gulabi", "mutthayya", "Gulabi", gender="female")

    fb.child("shubha", "mutthayya", "Shubha", gender="female")
    fb.child("padmavathi", "mutthayya", "Padmavathi", gender="female")

    fb.spouse("balakrishna", "padmavathi", "Balakrishna", gender="male")
    fb.child("nimmi", "padmavathi", "Nimmi", gender="female")
    fb.child("reshma", "padmavathi", "Reshma", gender="female")
    fb.child("munna", "padmavathi", "Munna", gender="male", **DECEASED)

    fb.spouse("praveen", "nimmi", "Praveen", gender="male")
    fb.child("sristi", "nimmi", "Sristi", gender="female")
    fb.child("sanvi", "nimmi", "Sanvi", gender="female")

    fb.spouse("ganesh", "reshma", "Ganesh", gender="male")
    fb.child("poorvi", "reshma", "Poorvi", gender="female")
    fb.child("gaman", "reshma", "Gaman", gender="male")

    # ── Seena + Lakshmi and their side ─────────────────────────────────
    fb.root("seena", "Seena", gender="male")
    fb.spouse("lakshmi", "seena", "Lakshmi", gender="female")

    fb.child("ananda", "seena", "Ananda", gender="male")
    fb.child("ramakrishna", "seena", "Ramakrishna", gender="male")
    fb.child("keshava", "seena", "Keshava", gender="male")
    fb.child("bhaskar", "seena", "Bhaskar", gender="male", **DECEASED)
    fb.child("shantha", "seena", "Shantha", gender="female")
    fb.child("vedha", "seena", "Vedha", gender="female")
    fb.child("babu_sr", "seena", "Babu", gender="male", bio="Varun's father — youngest of the siblings")

    # Ananda + Pushpa
    fb.spouse("pushpa", "ananda", "Pushpa", gender="female")
    fb.child("vinod", "ananda", "Vinod", gender="male", bio="Unmarried")
    fb.child("vidya", "ananda", "Vidya", gender="female")
    fb.spouse("vaibov", "vidya", "Vaibov", gender="male", **DECEASED)
    fb.child("kk", "vidya", "KK")

    # Ramakrishna + Sulochana
    fb.spouse("sulochana", "ramakrishna", "Sulochana", gender="female")
    fb.child("rajani", "ramakrishna", "Rajani", gender="female")
    fb.child("ashwini", "ramakrishna", "Ashwini", gender="female")

    # Rajani's husband is a DIFFERENT Babu from babu_sr above — separate record.
    fb.spouse("babu_rajani_husband", "rajani", "Babu", gender="male", bio="Rajani's husband")
    fb.child("aishu", "rajani", "Aishu", gender="female")
    fb.child("sonu", "rajani", "Sonu", gender="male")

    fb.spouse("ravi", "ashwini", "Ravi", gender="male")
    fb.child("prajna", "ashwini", "Prajna", gender="female")

    # Keshava + Mohini
    fb.spouse("mohini", "keshava", "Mohini", gender="female")
    fb.child("shilpa", "keshava", "Shilpa", gender="female")
    fb.child("roopa", "keshava", "Roopa", gender="female")

    fb.spouse("anil", "shilpa", "Anil", gender="male")
    fb.child("adyan", "shilpa", "Adyan", gender="male")
    fb.child("ayra", "shilpa", "Ayra", gender="female")

    fb.spouse("jeevan", "roopa", "Jeevan", gender="male")
    # Roopa + Jeevan: no children currently.

    # Bhaskar + Vasnthi
    fb.spouse("vasnthi", "bhaskar", "Vasnthi", gender="female")
    fb.child("bhavana", "bhaskar", "Bhavana", gender="female")
    fb.child("pavan", "bhaskar", "Pavan", gender="male")
    fb.child("pallavi", "bhaskar", "Pallavi", gender="female")

    fb.spouse("bhavana_husband", "bhavana", "Bhavana's husband", gender="male")
    fb.child("x", "bhavana", "X")

    fb.spouse("pavan_wife", "pavan", "Pavan's wife", gender="female")
    fb.child("pavan_kid", "pavan", "Pavan's child")

    fb.spouse("pallavi_husband", "pallavi", "Pallavi's husband", gender="male")
    fb.child("pallavi_kid", "pallavi", "Pallavi's child")

    # Shantha + Ramesh
    fb.spouse("ramesh", "shantha", "Ramesh", gender="male")
    fb.child("rajath", "shantha", "Rajath", gender="male")
    fb.child("ranjitha", "shantha", "Ranjitha", gender="female")

    fb.spouse("rajath_wife", "rajath", "Rajath's wife", gender="female")
    fb.child("rajath_kid", "rajath", "Rajath's child")

    fb.spouse("rathnakar", "ranjitha", "Rathnakar", gender="male")
    fb.child("laksha", "ranjitha", "Laksha")

    # Vedha + DDP
    fb.spouse("ddp", "vedha", "DDP", gender="male", **DECEASED)
    fb.child("divya", "vedha", "Divya", gender="female")
    fb.child("deepu", "vedha", "Deepu", gender="male")
    fb.child("deechu", "vedha", "Deechu", gender="female")

    fb.spouse("ani", "divya", "Ani", gender="male")
    fb.child("ayush", "divya", "Ayush", gender="male")

    fb.spouse("kiran", "deepu", "Kiran", gender="female")
    fb.child("keeyan", "deepu", "Keeyan")

    fb.spouse("shreeya", "deechu", "Shreeya", gender="female")
    fb.child("shrehith", "deechu", "Shrehith")

    # ── Tie the two sides together: Babu (Varun's father) marries Shubha ──
    # Shubha already exists (Mutthayya's daughter) — so instead of creating
    # her again, Babu's family unit is the anchor and Shubha is added as
    # HIS spouse... but Shubha already has her own person record. The API
    # only supports "new person becomes X's relative", not linking two
    # already-existing people — so this script creates Babu's side first
    # and adds Varun/Varsha as children of babu_sr directly. Shubha is
    # already correctly Mutthayya's daughter in the tree; linking her
    # marriage to Babu as well requires either a small backend addition
    # (a "link existing person" endpoint) or doing that one link by hand
    # in the UI after seeding — everything else is fully automatic.
    fb.child("varun", "babu_sr", "Varun", gender="male", bio="You")
    fb.child("varsha", "babu_sr", "Varsha", gender="female", bio="Your sister")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--name", default="Seed User")
    parser.add_argument("--email", default="rootline.seed@example.com")
    parser.add_argument("--password", default="seed-password-123")
    args = parser.parse_args()

    session = httpx.Client(timeout=20)
    print(f"Logging in to {args.base_url} as {args.email} ...")
    token = register_or_login(session, args.base_url, args.name, args.email, args.password)

    fb = FamilyBuilder(session, args.base_url, token)
    print("Creating people ...")
    try:
        build(fb)
    except RuntimeError as exc:
        print(f"\nStopped early: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Done — {len(fb.registry)} people created for {args.email}.")
    print("Log in with that account in the app and open /tree to see it.")


if __name__ == "__main__":
    main()
