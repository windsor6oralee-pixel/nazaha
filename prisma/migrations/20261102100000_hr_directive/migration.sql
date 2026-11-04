-- HRDirective: one-per-application "sticky instruction" written by HR,
-- visible on the candidate dashboard until HR replaces it. Optional single
-- candidate reply when allowReply=true.

CREATE TABLE "hr_directives" (
    "id"                 TEXT        NOT NULL,
    "applicationId"      TEXT        NOT NULL,
    "title"              TEXT        NOT NULL,
    "body"               TEXT        NOT NULL,
    "allowReply"         BOOLEAN     NOT NULL DEFAULT FALSE,
    "candidateReply"     TEXT,
    "candidateReadAt"    TIMESTAMP(3),
    "candidateRepliedAt" TIMESTAMP(3),
    "createdByUserId"    TEXT        NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hr_directives_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_directives_applicationId_key"
    ON "hr_directives" ("applicationId");

ALTER TABLE "hr_directives"
    ADD CONSTRAINT "hr_directives_application_fk"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_directives"
    ADD CONSTRAINT "hr_directives_user_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- HRDirectiveTemplate: per-org quick-pick templates for the directive editor.

CREATE TABLE "hr_directive_templates" (
    "id"             TEXT        NOT NULL,
    "organizationId" TEXT        NOT NULL,
    "title"          TEXT        NOT NULL,
    "body"           TEXT        NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hr_directive_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hr_directive_templates_org_idx"
    ON "hr_directive_templates" ("organizationId");

ALTER TABLE "hr_directive_templates"
    ADD CONSTRAINT "hr_directive_templates_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
