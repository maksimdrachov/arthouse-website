# ArtHouse Website

A simple website used for showcasing the works of artists, which are all part of the same collective.

## Core functionality

### Public

- Home page
  - Shows a 6x6 grid of random items from different stores
  - Below that a list of (randomly ordered) artist store banners (linking to their store)
- Artist page
  - Top of the page: banner (uploaded by artist)
  - Below that 3x3 grid of items, if more present, then more rows
- Product page
  - Center: photos with ability to click arrows for next/previous photo
  - Availability: Available (green), Reserved (orange), Sold (red)
  - Below that the description
  - Below that: reserve button
- Reserve page
  - If client click Reserve, they should be redirected to a reserve page where they can:
    - Telegram 
    - Artist bank account details (item is reserved as soon as right amount is deposited)

### Private

- Registration page

Every artist can create their own account on the website after registering using a given code (6-digit number).

The account registration consists of the following:
- Registration code
- Artist name
- Password
- Bank #
- About (optional)
- Telegram (optional)
- Instagram (optional)
- Store banner (optional)

Once registered they should be able to edit all of the above, in addition to adding/removing items from their store
- Add item
  - Name
  - Price
  - Description
  - Photos
- Remove item
- Update item (edit the item and also change the availability)

- Admin page

There should be one account that has higher privileges and can:
- generate registration codes
- look up a list of reservations
- look up a list of items sold

## Style

The style should be inspired by early 2000s web design.
