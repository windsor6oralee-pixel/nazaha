-- Directive type (info / urgent / appointment) + per-directive e-mail flag.
-- Lets HR express urgency and opt in to an automatic mail notification to
-- the candidate when the directive is created or updated.

CREATE TYPE "DirectiveType" AS ENUM ('INFO', 'URGENT', 'APPOINTMENT');

ALTER TABLE "hr_directives"
    ADD COLUMN "type"          "DirectiveType" NOT NULL DEFAULT 'INFO',
    ADD COLUMN "notifyByEmail" BOOLEAN         NOT NULL DEFAULT FALSE;

ALTER TABLE "hr_directive_templates"
    ADD COLUMN "type" "DirectiveType" NOT NULL DEFAULT 'INFO';
