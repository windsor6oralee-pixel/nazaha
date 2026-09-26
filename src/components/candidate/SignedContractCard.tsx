import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface SignedContractCardProps {
  contractName: string;
  candidateName: string;
  signedAt?: string;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink" style={{ margin: 0, fontWeight: 500, textAlign: "end" }}>{children}</dd>
    </div>
  );
}

export function SignedContractCard({
  contractName,
  candidateName,
  signedAt,
}: SignedContractCardProps) {
  const firstName = candidateName.split(" ")[0];
  return (
    <Card title={contractName}>
      <Badge tone="done">موقَّع إلكترونياً</Badge>

      <dl
        className="flex flex-col gap-2 rounded-12 border border-border-100 bg-surface-000"
        style={{ margin: "var(--space-16) 0", padding: "var(--space-16)", fontSize: 13, direction: "rtl" }}
      >
        <Row label="الموقِّع">{candidateName}</Row>
        {signedAt && (
          <Row label="وقت التوقيع">
            <span className="font-numeric">
              {new Date(signedAt).toLocaleString("ar-SA-u-nu-latn", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </Row>
        )}
        <Row label="الطريقة">توقيع إلكتروني مكتوب</Row>
      </dl>

      <p className="text-ink-muted" style={{ margin: 0, fontSize: 13 }}>
        {firstName}، هذا التوقيع ملزم قانونياً بموجب نظام التعاملات الإلكترونية. احتفظ بهذه الصفحة مرجعاً.
      </p>
    </Card>
  );
}
