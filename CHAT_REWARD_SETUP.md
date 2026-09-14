# Chat Reward Balance Setup

The 20-message chat reward now credits the user's real `profiles.balance` in Supabase.

## Run once in Supabase

Open **Supabase → SQL Editor**, paste and run:

```text
drizzle/migrations/0004_chat_rewards.sql
```

or run the equivalent `SUPABASE_CHAT_REWARDS_SETUP.sql` file.

## How it works

1. An activated user starts a foreigner chat.
2. When the conversation reaches 20 total messages, the chat closes.
3. The app calls `credit_chat_reward()` in Supabase.
4. Supabase validates the foreigner and reward amount server-side.
5. The reward is added to `profiles.balance`.
6. A unique `(user_id, session_id)` prevents the same chat session from being credited twice.
7. When the user returns to the home/account area, Current Balance reads the updated value from Supabase.

The reward is a real balance credit in the database. It is not a fake toast-only balance.
