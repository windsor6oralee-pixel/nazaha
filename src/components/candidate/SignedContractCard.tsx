import { CheckCircle, FileSignature } from "lucide-react";

interface SignedContractCardProps {
  contractName: string;
  candidateName: string;
  signedAt?: string;
}

export function SignedContractCard({
  contractName,
  candidateName,
  signedAt,
}: SignedContractCardProps) {
  const firstName = candidateName.split(" ")[0];
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ borderColor: "#6EE7B7", background: "#F0FDF4" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "#D1FAE5" }}
        >
          <FileSignature className="w-5 h-5" style={{ color: "#065F46" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: "#065F46" }}>
            {contractName}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#10B981" }} />
            <span className="text-xs font-medium" style={{ color: "#047857" }}>
              موقَّع إلكترونياً
            </span>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl p-3 text-xs space-y-1.5"
        style={{ background: "#D1FAE5", direction: "rtl" }}
      >
        <div className="flex justify-between">
          <span style={{ color: "#065F46" }}>الموقِّع</span>
          <span className="font-medium" style={{ color: "#064E3B" }}>{candidateName}</span>
        </div>
        {signedAt && (
          <div className="flex justify-between">
            <span style={{ color: "#065F46" }}>وقت التوقيع</span>
            <span className="font-medium" style={{ color: "#064E3B" }}>
              {new Date(signedAt).toLocaleString("ar-SA", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span style={{ color: "#065F46" }}>الطريقة</span>
          <span className="font-medium" style={{ color: "#064E3B" }}>توقيع إلكتروني مكتوب</span>
        </div>
      </div>

      <p className="text-xs" style={{ color: "#047857" }}>
        {firstName}، هذا التوقيع ملزم قانونياً بموجب نظام التعاملات الإلكترونية. احتفظ بهذه الصفحة مرجعاً.
      </p>
    </div>
  );
}
