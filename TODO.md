1. [x] Database access layer
   Add a small DB module around SQLite in src/, with helpers for artists, registration codes, items, photos, and reservations.

2. [x] Auth + registration
   Implement:
    - admin seed account
    - admin-generated 6-digit registration codes
    - artist registration using a valid code
    - password hashing
    - login/logout
    - session middleware
    - role checks for artist/admin pages

3. [x] Artist dashboard
   Implement artist profile editing and item CRUD:
    - add item
    - edit item
    - upload photos
    - update availability
    - remove item

4. [x] Public pages
   Once real data exists, build:
    - homepage random 6x6 item grid
    - artist banner list
    - artist store page
    - product page photo carousel

5. [x] Reservation flow
   Add reserve page behavior and reservation records. This should come after product pages exist.
   If a customer places a reservation he should leave his contact info (telegram) and be asked to deposit x euro to y bank account to finalize the reservation.
   The payment should include the name of the item in the description.

6. [x] Admin reports
   Implement:
    - registration code generation
    - list reservations (admin should be able to see details of customer)
    - list sold items
    - list/remove artists
