-- HRDirectiveHistory: snapshot of a replaced directive. Written automatically
-- by upsertDirective before overwriting, so HR always sees the full chronology
-- of what they told this candidate without preserving stale "active" rows.

CREATE TABLE "hr_directive_history" (
    "id"                 TEXT        NOT NULL,
    "applicationId"      TEXT        NOT NULL,
    "type"               "DirectiveType" NOT NULL DEFAULT 'INFO',
    "title"              TEXT        NOT NULL,
    "body"               TEXT        NOT NULL,
    "allowReply"         BOOLEAN     NOT NULL DEFAULT FALSE,
    "notifyByEmail"      BOOLEAN     NOT NULL DEFAULT FALSE,
    "candidateReply"     TEXT,
    "candidateReadAt"    TIMESTAMP(3),
    "candidateRepliedAt" TIMESTAMP(3),
    "createdByUserId"    TEXT        NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL,
    "archivedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hr_directive_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hr_directive_history_app_idx"
    ON "hr_directive_history" ("applicationId", "archivedAt");
