1. [x] Database access layer
   Add a small DB module around SQLite in src/, with helpers for artists, registration codes, items, photos, and reservations.

2. Auth + registration
   Implement:
    - admin seed account
    - admin-generated 6-digit registration codes
    - artist registration using a valid code
    - password hashing
    - login/logout
    - session middleware
    - role checks for artist/admin pages

3. Artist dashboard
   Implement artist profile editing and item CRUD:
    - add item
    - edit item
    - upload photos
    - update availability
    - remove item

4. Public pages
   Once real data exists, build:
    - homepage random 6x6 item grid
    - artist banner list
    - artist store page
    - product page photo carousel

5. Reservation flow
   Add reserve page behavior and reservation records. This should come after product pages exist.

6. Admin reports
   Implement:
    - registration code generation
    - reservations list
    - sold items list
