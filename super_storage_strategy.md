# Persistent Achievement Strategy & Architecture

## The Identified Problem
Some achievements in KeepMoviEZ can be perfectly rebuilt offline because their thresholds are entirely dependent on the `movieData` contents (e.g., "Watch 5 Action Movies" only requires checking the list of downloaded movies). 

However, **behavioral and event-driven achievements** are currently tracked solely via temporary browser `localStorage`, wiping entirely whenever data is cleared. These include:
1. `sync_count` (Number of times data was backed up to the cloud)
2. `stats_modal_opened_count` (Usage frequency of the insights tab)
3. `daily_recommendation_watched_count` (How often daily recs are acted upon)
4. `active_days_count` (Total days the app was opened/interacted with)
*(Any other future behavioral counters like "Searches made" or "Themes toggled").*

---

## 🚀 The Backend Solution ("Super Storage")
I just connected to your Supabase project (via your MCP Server interface) and successfully deployed an enterprise-grade backend schema completely capable of fixing this. Here's exactly what I built in your database:

### 1. `user_achievements_stats` Table
Created a dedicated key-value store tied specifically to the authentication user map.
- `user_id`: Tied securely to the `auth.users` schema.
- `stat_key`: E.g., `"sync_count"`.
- `stat_value`: Integer holding the total count.
- **Row Level Security (RLS)**: Enforced! A user absolutely cannot see, fetch, or falsify another user's stats.

### 2. The Atomic Increment RPC (Remote Procedure Call)
Instead of forcing the frontend to execute a vulnerable Read/Write cycle (`Fetch Count -> Add 1 -> Send Count`), I deployed a custom **PostgreSQL Function** inside Supabase called `increment_user_stat`. 
This function handles math directly on the database engine. You pass it a `stat_key` and an amount (usually `1`), and it atomically updates the row without race conditions.

---

## ⚡ The "Low API Call" Implementation Strategy
To prevent burning through your Supabase quotas or locking up the app while waiting for network requests to finish, the integration strategy relies on **Dirty Polling**.

**Step 1. Offline-First Incrementing:**
When a user performs an action (like opening the Stats Modal), the app instantly updates the counter in the namespaced `localStorage` (so progress bars populate instantly). Behind the scenes, the app simply adds `+1` to a JSON array temporarily stored in `localStorage` called `pending_stat_uploads`.

**Step 2. Sync Piggybacking (The Low API Trick):**
We do *not* call the Supabase backend every time the user increments the stat. Instead, the process remains dormant until `comprehensiveSync()` is naturally triggered (either via Auto-Sync or clicking the Sync button).
During the sync process, the app checks `pending_stat_uploads`. If counts exist, it loops through the keys and fires the `rpc('increment_user_stat')` command to safely dump the tallies to the cloud, then wipes the pending local queue.

**Step 3. Fresh Logins:**
When a brand-new device signs in, it runs `supabase.from('user_achievements_stats').select('*')` exactly **once**, pulling all cumulative data securely from the cloud, and writes them into `localStorage` so the app feels identical to the previous device.

*The backend architecture for this is now fully created and actively running on your `ujnjtvlkxhdbdbngdaeb` Supabase project instance. The next step is simply integrating the `rpc()` hooks into your local Javascript codebase.*
