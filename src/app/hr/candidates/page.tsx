import { auth } from "@/infrastructure/auth/auth";
import { getCandidatesByOrganization } from "@/infrastructure/repositories/candidate.repository";
import { CandidatesClient } from "@/components/hr/CandidatesClient";
import { parseStatusFilter } from "@/lib/candidate-filter";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CandidatesPage({ searchParams }: Props) {
  const session = await auth();
  const candidates = await getCandidatesByOrganization(
    session!.user.organizationId
  );

  /* العدّادات في /hr تشير إلى ?status= — نطبّق التصفية من الرابط. */
  const raw = await searchParams;
  const initialStatus = parseStatusFilter(raw.status);

  return <CandidatesClient candidates={candidates} initialStatus={initialStatus} />;
}
