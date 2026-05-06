# Firestore Security Spec

## Data Invariants
1. A Bid cannot exist without a valid ownerId that matches the authenticated user.
2. Only the owner of a Bid can list, read, update, or delete it.
3. A BidItem can only be created, read, updated, or deleted if the parent Bid belongs to the authenticated user's uid.
4. Numerical calculations (taxes, margin, values) are bounded properly.

## The "Dirty Dozen" Payloads
1. Create Bid for another user (Identity spoofing)
2. Create Bid without authenticated user
3. Read another user's Bid
4. Inject a huge ID string
5. Create Bid with missing numeric fields (Schema breach)
6. Update a Bid's ownerId (State tampering)
7. Update Bid with JSON structure containing extra ghost fields
8. Read items from a Bid owned by someone else
9. Create an item in someone else's Bid
10. Update an item with invalid data types
11. Send a timestamp that is not `request.time`
12. Attempt to list Bids without the explicit `where('ownerId', '==', uid)` query filter.
