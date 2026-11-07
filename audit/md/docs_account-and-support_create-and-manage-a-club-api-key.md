# Create and manage a club API key

Every club can connect its own tools to Superstat through the public API. An API key authenticates those requests, and it belongs to the club rather than to one person.

---

## Create a key

<ol class="steps-list"><li><p>Open `Settings → API keys`.</p></li><li><p>Enter a name for the key, such as `Club website`.</p></li><li><p>Choose `Create key`.</p></li><li><p>Copy the secret.</p></li></ol>

> The secret starts with `ss_live_` and is shown only once. Superstat keeps the key's name and a short prefix, shown in the API-key list, but never the full secret again.

---

## Use the key

Send the secret as a bearer token on each request:

```bash
curl https://api.superstatsport.com/v1/clubs \
  -H "Authorization: Bearer ss_live_your_secret"
```

`X-Api-Key: ss_live_your_secret` works the same way. The key can read that club's teams, rosters, matches, and insights. Access is free for every club, with nothing to enable and no extra charge.

---

## Revoke a key

Open `Settings → API keys` and choose `Revoke` next to the key. Requests sent with it fail right away. A revoked key stays in the list so you can see when it was turned off. A club can hold up to 20 active keys at a time.

---

## Who can manage keys

Only the club owner can create, view or revoke API keys. An admin or editor who is not the owner cannot manage keys. If the section is missing, check the selected club and ask its owner.

---

## Related guides

-   [Update your profile, club, and team settings](/docs/account-and-support/update-your-profile-club-and-team-settings)
    
-   [Manage your subscription and billing](/docs/account-and-support/manage-your-subscription-and-billing)
