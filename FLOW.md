# Legacy AI — full system flow

Everything below describes the shipped front-end in `src/`. Interview logic, question sequencing,
memory extraction, and AI reasoning live in the backend and the approved brain documents; this file
covers screens, navigation, and who is allowed to see what.

---

## 1. The shape of the system

There are two worlds.

**The public site** (signed out) — sells the idea and takes an account.
`/` home · `/how-it-works` · `/the-archive` · `/pricing` · `/about` · `/signin`

**The archive** (signed in) — one main screen plus a few working surfaces.

```
/overview          THE MAIN SCREEN — all archive data, one page, bands
  #setup  #stories  #voice  #photos  #people  #wisdom  #ask  #access
/interview         guided conversation                       (owner only)
/edit              add / correct / remove + create/edit live avatar (owner only)
/voice-and-photo   portrait + voice capture, live-avatar provisioning (owner only)
/family-access     invitations, roster, permissions          (owner + administrator)
/ask               Ask the archive, full surface
/settings          account, profile, privacy, sign out
/join?token=…      invitation acceptance
```

Old routes still work and redirect: `/legacy → /overview`, `/home → /overview`,
`/stories|/voice-memories|/photos|/people → /overview#<band>`, `/avatar → /ask`,
`/manage → /family-access`, `/studio → /voice-and-photo`, `/live-avatar → /voice-and-photo`.
The `?c=<creatorId>` query is preserved through every redirect.

---

## 2. The main screen

`src/components/archive/ArchiveHome.tsx` renders the whole archive as a single scrolling page.
Each band is a `<section id>` from the registry in `sections.ts`, and the read-only blocks live in
`blocks.tsx`:

| Band | id | Holds |
| --- | --- | --- |
| Archive setup | `setup` | setup percentage, three stages, counts, next action, recent activity |
| Stories | `stories` | every entry: title, date, summary, lesson, people |
| Voice memories | `voice` | the recording, with playback |
| Photos & documents | `photos` | gallery with captions |
| People | `people` | relationships and how they were described |
| What you were told | `wisdom` | advice and values |
| Ask the archive | `ask` | suggested questions, opens `/ask` |
| Family Access | `access` | who is invited, link to management |

**Navigation is in-page.** The side navigation lists the bands the current viewer may see; clicking
one scrolls the page to it (`window.scrollTo`, smooth). An `IntersectionObserver` scroll-spy
highlights the band you are reading. `/overview#stories` deep-links straight to a band.

Below a divider the sidebar holds real routes — Interview (owner), Family Access (owner and
administrator), Settings — so page-level work never hides inside the scroll.

**The bottom-left archive identity** shows the owner's profile photo (monogram fallback) and their
archive name. For the **owner** it is a button reading *Edit archive* and it opens `/edit`. For
everyone else it is not a link: it reads *Shared with you*, or *You help look after this* for an
administrator.

Nothing on the main screen edits anything. It is a reading surface for all three roles.

**One shell, no remounting.** `ArchiveLayout.tsx` mounts the sidebar and the data loader once and
renders each screen through an `<Outlet>`, so moving between `/overview`, `/edit`, `/ask`,
`/family-access`, and `/settings` swaps only the paper pane. The main screen lends the sidebar its
scroll function while it is mounted; from any other screen a band click routes to `/overview#<band>`.

---

## 3. Roles and determination

The permission matrix is `src/lib/permissions.ts` — the single source of truth. Visibility rules are
derived from it in `src/components/archive/sections.ts`; no screen tests role strings directly.

| | **creator** (owner) | **administrator** | **member** |
| --- | --- | --- | --- |
| Read stories, voice, photos, people, wisdom | ✅ | ✅ | ✅ |
| Ask the archive | ✅ | ✅ | ✅ |
| Archive setup band (progress) | ✅ | ✅ | ❌ hidden |
| Family Access band + `/family-access` | ✅ | ✅ | ❌ hidden |
| Interview (`/interview`) | ✅ | ❌ redirected | ❌ redirected |
| Edit archive (`/edit`) | ✅ | ❌ redirected | ❌ redirected |
| Live avatar setup (`/voice-and-photo`) | ✅ | ❌ redirected | ❌ redirected |
| Invite family, remove members | ✅ | ✅ (members only) | ❌ |
| Change roles, appoint administrators | ✅ | ❌ | ❌ |
| Settings (own account) | ✅ | ✅ | ✅ |

Enforcement happens in three places, deliberately overlapping:

1. **Navigation** — items are not rendered for roles that lack the action.
2. **Screens** — `RequireAction` guards `/edit` (`EDIT_MEMORY`), `/voice-and-photo`
   (`EDIT_PROFILE`), and `/family-access` (`INVITE_USER` or `MANAGE_ACCESS`), sending anyone else
   back to `/overview`; `/interview` checks `canAccessInterview(me)` and bounces to the archive.
3. **API** — every request carries the Supabase token and the backend re-checks. The front-end
   never grants access the backend would refuse.

The viewer's role is resolved once, in `data.ts`, from the membership returned by `accessApi.me()`
for this archive, falling back to the profile role and then to `member` — least privilege by
default (`resolveViewerRole`).

Each role's standfirst line on the main screen states what they are looking at, so an administrator
is never confused about whose archive it is (`roleStandfirst` in `sections.ts`).

---

## 4. Journeys

**Archive owner, first time**
`/` → *Begin your archive* → `/signin?new=1` → account created → no archive yet, so the router
lands on `/interview` → Foundation questions, answers saved per question → completion extracts
entries → `/overview` with the setup band showing Foundation complete → sidebar bottom-left
*Edit archive* → `/edit` to set a name and photograph, add entries and photographs, record a voice
memory, and create or edit a live avatar (`/voice-and-photo`) → Family Access to invite people.

**Archive owner, returning**
`/` → session found → `/overview?c=…`. Sidebar scrolls between bands; *Continue interview* in the
setup band resumes the current stage; *Edit archive* for anything that changes content.

**Invited family member**
Invitation link → `/join?token=…` → creates or signs in to an account → membership accepted →
`/overview?c=<owner>` with the setup and access bands hidden. They read entries, play the voice
memory, browse photographs and people, and open `/ask` to ask a question. No edit affordances exist
anywhere in their interface.

**Administrator**
Same landing as a member, plus the setup band (so they can see how the archive is progressing) and
Family Access, where they can create member invitations and remove members. They cannot appoint
another administrator, change roles, or reach `/edit`, `/interview`, or `/voice-and-photo` — the
owner's words stay the owner's.

---

## 5. Data flow

`useArchiveLoader(creatorId)` in `src/components/archive/data.ts` is the single loader for every
archive surface. It runs once per archive in `ArchiveLayout` and is shared through
`useArchiveContext()`. It calls:

- `interviewApi.getProfile(creatorId)` → creator, memories, gallery, relationships, values, wisdom,
  coverage, session summaries, and the caller's `role` for this archive
- `avatarApi.getAssets({ creatorId })` → portrait, voice sample, voice-clone and live-avatar status
- `accessApi.me()` → the caller's memberships, used to resolve the canonical viewer role
- `accessApi.members(creatorId)` → the roster, only when the role may manage access

From that it derives `counts` (stories, voice, people, photographs), `setupPct`, `level`, and the
`activity` rows — where each label matches its object: *Story gathered*, *Voice memory added*,
*Photograph added*, *Person added*, *Family access updated*.

Writes go through the same API modules and all live on `/edit` or `/voice-and-photo`:
`interviewApi.createMemory/updateMemory/deleteMemory`,
`interviewApi.createGalleryItem/deleteGalleryItem`, `uploadMedia` + `avatarApi.saveVoiceSample`,
`avatarApi.saveIdentity/saveAssets`, `avatarApi.provision` for the live avatar, and the
`accessApi.*` invitation calls. `/edit` is where the owner creates or edits the live avatar
(portrait + voice + generate). Every write calls `ctx.reload()`, which refreshes the shared data
without remounting the shell.

`localStorage` holds two keys only: the last-opened archive id and a pending invitation token.

---

## 6. Language rules the flow depends on

Progress is always **archive setup**, never a person: `Archive setup: 34% complete`,
`Foundation complete · Enrichment in progress`, `6 stories gathered · 3 voice memories added ·
5 people added · 12 photographs added`. Stage names are Foundation, Enrichment, Family Archive.

The archive answers only from recorded material and says when it does not know. Voice and likeness
require explicit permission, stated on every surface that touches them. All locked strings live in
`src/design/copy.ts` — change them there, not in screens.
