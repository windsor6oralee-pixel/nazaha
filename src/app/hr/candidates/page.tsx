import { auth } from "@/infrastructure/auth/auth";
import { getCandidatesByOrganization } from "@/infrastructure/repositories/candidate.repository";
import { CandidatesClient } from "@/components/hr/CandidatesClient";

export default async function CandidatesPage() {
  const session = await auth();
  const candidates = await getCandidatesByOrganization(
    session!.user.organizationId
  );

  return <CandidatesClient candidates={candidates} />;
}
