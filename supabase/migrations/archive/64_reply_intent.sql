-- ==============================================================================
-- 64_reply_intent.sql
-- Sort every reply with free word rules (no AI, no cost):
--   opt_out · out_of_office · not_interested · interested · question · other
-- Labels only: the lead's stage is still changed by staff, never automatically.
-- Applied to 1:1 replies (messages, inbound) and campaign replies, as they arrive.
-- The thread keeps its latest reply's label for the lists and the dashboard.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- The rules, in priority order. Returns the label and the words that matched.
CREATE OR REPLACE FUNCTION "sales-pipe".reply_intent(p_text text, OUT intent text, OUT matched text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = "sales-pipe", public
AS $$
DECLARE
    t text := lower(regexp_replace(coalesce(p_text, ''), '[’‘`]', '''', 'g'));
    m text[];
BEGIN
    t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
    IF t = '' THEN
        intent := 'other'; RETURN;
    END IF;

    m := regexp_match(t, '\m(stop|unsubscribe|opt[ -]?out|remove me|take me off|do not (contact|message|email|text)|don''t (contact|message|email|text)|no more (messages|emails|texts))\M');
    IF m IS NOT NULL THEN intent := 'opt_out'; matched := m[1]; RETURN; END IF;

    m := regexp_match(t, '(out of (the )?office|on (annual )?leave|auto(matic)?[ -]?reply|away from (the|my) (office|desk)|currently away|limited access to (my )?email|(will|''ll) be back on)');
    IF m IS NOT NULL THEN intent := 'out_of_office'; matched := m[1]; RETURN; END IF;

    m := regexp_match(t, '(not interested|no thanks|no thank you|not (right )?now|not at the moment|not for us|we(''re| are) (all )?(set|sorted|good)|already (have|got) (a|an|one|someone)|(don''t|do not) need|no need|not looking|maybe (later|next year))');
    IF m IS NOT NULL THEN intent := 'not_interested'; matched := m[1]; RETURN; END IF;

    m := regexp_match(t, '\m(interested|y+e+s+|yeah|yep|yup|sure|ok(ay)?|sounds good|go ahead|tell me( more)?|more (info|information|details)|how much|price|pricing|cost|quote|call me|give me a (call|ring)|ring me|book|schedule|meeting|demo|let''s (talk|chat)|happy to)\M');
    IF m IS NOT NULL THEN intent := 'interested'; matched := m[1]; RETURN; END IF;

    m := regexp_match(t, '(\?|^(what|how|when|where|who|why|which|can you|could you|do you|is it|are you|is there)\M)');
    IF m IS NOT NULL THEN intent := 'question'; matched := NULLIF(btrim(m[1]), ''); RETURN; END IF;

    intent := 'other';
END;
$$;

ALTER TABLE "sales-pipe".messages
    ADD COLUMN IF NOT EXISTS intent text CHECK (intent IN ('opt_out', 'out_of_office', 'not_interested', 'interested', 'question', 'other')),
    ADD COLUMN IF NOT EXISTS intent_matched text;
ALTER TABLE "sales-pipe".campaign_replies
    ADD COLUMN IF NOT EXISTS intent text CHECK (intent IN ('opt_out', 'out_of_office', 'not_interested', 'interested', 'question', 'other')),
    ADD COLUMN IF NOT EXISTS intent_matched text;
ALTER TABLE "sales-pipe".threads
    ADD COLUMN IF NOT EXISTS last_reply_intent text;

-- Label a reply as it is saved
CREATE OR REPLACE FUNCTION "sales-pipe".set_reply_intent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = "sales-pipe", public
AS $$
DECLARE r record;
BEGIN
    -- messages: only replies (inbound); campaign_replies has no direction column
    IF TG_TABLE_NAME = 'messages' AND (to_jsonb(NEW) ->> 'direction') IS DISTINCT FROM 'inbound' THEN
        RETURN NEW;
    END IF;
    SELECT * INTO r FROM "sales-pipe".reply_intent(concat_ws(' ', NEW.subject, NEW.body));
    -- The subject alone ("Re: …") says little; prefer what the body says when it says anything
    IF NEW.body IS NOT NULL AND btrim(NEW.body) <> '' THEN
        SELECT * INTO r FROM "sales-pipe".reply_intent(NEW.body);
        IF r.intent = 'other' AND NEW.subject IS NOT NULL THEN
            SELECT * INTO r FROM "sales-pipe".reply_intent(NEW.subject);
        END IF;
    END IF;
    NEW.intent := r.intent;
    NEW.intent_matched := r.matched;
    RETURN NEW;
END;
$$;

-- The thread shows its latest reply's label
CREATE OR REPLACE FUNCTION "sales-pipe".set_thread_reply_intent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
BEGIN
    IF NEW.direction = 'inbound' AND NEW.thread_id IS NOT NULL THEN
        UPDATE "sales-pipe".threads SET last_reply_intent = NEW.intent WHERE id = NEW.thread_id;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".set_reply_intent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".set_thread_reply_intent() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".reply_intent(text) TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_messages_reply_intent ON "sales-pipe".messages;
CREATE TRIGGER trg_messages_reply_intent BEFORE INSERT OR UPDATE OF body, subject ON "sales-pipe".messages
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".set_reply_intent();

DROP TRIGGER IF EXISTS trg_messages_thread_reply_intent ON "sales-pipe".messages;
CREATE TRIGGER trg_messages_thread_reply_intent AFTER INSERT ON "sales-pipe".messages
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".set_thread_reply_intent();

DROP TRIGGER IF EXISTS trg_campaign_replies_intent ON "sales-pipe".campaign_replies;
CREATE TRIGGER trg_campaign_replies_intent BEFORE INSERT OR UPDATE OF body, subject ON "sales-pipe".campaign_replies
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".set_reply_intent();

-- Label the replies already saved
UPDATE "sales-pipe".messages SET body = body WHERE direction = 'inbound';
UPDATE "sales-pipe".campaign_replies SET body = body;
UPDATE "sales-pipe".threads t SET last_reply_intent = (
    SELECT m.intent FROM "sales-pipe".messages m
    WHERE m.thread_id = t.id AND m.direction = 'inbound'
    ORDER BY m.created_at DESC LIMIT 1
);

COMMIT;

NOTIFY pgrst, 'reload schema';
