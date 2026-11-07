# Create and manage API keys

The Superstat API lets you pull your club's match data into your own website or tools. Every club can create keys, there's no extra charge, and a key only ever reads that club's data.

---

## Create a key

Open `Settings → API keys` in the web app and choose `Create key`. Give it a name that says where you'll use it, like `Club website`, then confirm. Superstat shows the secret once, starting with `ss_live_`. Copy it straight away: the full secret is never shown again.

> Only the club owner can create, view or revoke API keys. Being a club admin or editor does not grant access to key management.

A club can hold up to 20 active keys at a time. The settings list keeps each key's name, a short prefix shown in the API-key list, and when it was created and last used.

---

## Send the key with requests

Pass the secret as a bearer token, `Authorization: Bearer ss_live_...`, or use the `X-Api-Key: ss_live_...` header. Keep the key on a server. Don't ship it in a mobile app or in browser code, where anyone could read it.

---

## Revoke a key

In `Settings → API keys`, choose `Revoke` next to the key. Any request that still uses it fails straight away with an unauthorized error. Revoked keys stay in the list with the date they were turned off.

---

## What the API returns

The API reads the same data you see in the app: clubs, teams, rosters, matches, box scores, play-by-play events, and insights. It can also generate insights for a completed match if they haven't been written yet. Studio and coaching reports aren't part of it.

---

## Related guides

-   [Understand owners, editors, viewers, and player access](/docs/getting-started/understand-owners-editors-viewers-and-player-access)
    
-   [Invite staff and manage member permissions](/docs/account-and-support/invite-staff-and-manage-member-permissions)
    
-   [Update your profile, club, and team settings](/docs/account-and-support/update-your-profile-club-and-team-settings)
