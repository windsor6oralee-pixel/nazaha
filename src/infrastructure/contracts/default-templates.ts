// Default contract bodies seeded for every new tenant. No imports — this file is
// also loaded by prisma/seed.ts through a relative path (ts-node has no alias support).

export interface DefaultTemplate {
  type: "EMPLOYMENT_CONTRACT" | "CONFIDENTIALITY_AGREEMENT";
  nameAr: string;
  bodyHtml: string;
}

export const GOVERNMENT_EMPLOYMENT_CONTRACT: DefaultTemplate = {
  type: "EMPLOYMENT_CONTRACT",
  nameAr: "عقد العمل",
  bodyHtml: `
<h1>{{contract.nameAr}}</h1>
<p class="meta">حُرّر بتاريخ {{contract.date}}</p>

<p>بعون الله تعالى، وبناءً على قرار التعيين الصادر، تم إبرام هذا العقد بين كلٍّ من:</p>

<table class="parties">
  <tr>
    <th>الطرف الأول (جهة العمل)</th>
    <td><strong>{{org.officialNameAr}}</strong><br/>ويمثلها في هذا العقد {{org.signerName}} — {{org.signerTitle}}<br/>العنوان: {{org.address}}</td>
  </tr>
  <tr>
    <th>الطرف الثاني (الموظف)</th>
    <td><strong>{{candidate.nameAr}}</strong><br/>رقم الهوية الوطنية: {{candidate.nationalId}}<br/>البريد الإلكتروني: {{candidate.email}}</td>
  </tr>
</table>

<h2>المادة الأولى — طبيعة العمل</h2>
<p>يلتزم الطرف الثاني بالعمل لدى الطرف الأول في وظيفة <strong>{{candidate.jobTitle}}</strong> ضمن <strong>{{candidate.department}}</strong>، وأداء المهام المنوطة بهذه الوظيفة وفق الوصف الوظيفي المعتمد واللوائح النافذة.</p>

<h2>المادة الثانية — تاريخ المباشرة</h2>
<p>يبدأ سريان هذا العقد اعتباراً من تاريخ المباشرة الفعلية للعمل والمحدد في <strong>{{candidate.startDate}}</strong>، ويُعدّ الطرف الثاني مباشراً لعمله بتوقيع محضر المباشرة.</p>

<h2>المادة الثالثة — الالتزام بالأنظمة</h2>
<p>يلتزم الطرف الثاني بجميع الأنظمة واللوائح والتعليمات الصادرة عن الطرف الأول والجهات الحكومية المختصة، وبما تقتضيه الوظيفة العامة من واجبات وآداب.</p>

<h2>المادة الرابعة — السرية</h2>
<p>يلتزم الطرف الثاني بالمحافظة على سرية المعلومات والبيانات والوثائق التي يطّلع عليها بحكم عمله، وعدم إفشائها أو استخدامها لغير أغراض العمل، ويستمر هذا الالتزام بعد انتهاء العلاقة الوظيفية.</p>

<h2>المادة الخامسة — النزاهة وتعارض المصالح</h2>
<p>يُقرّ الطرف الثاني بالتزامه بمبادئ النزاهة والشفافية ومكافحة الفساد، وبالإفصاح الفوري عن أي حالة تعارض مصالح فعلية أو محتملة، وفق الأنظمة المعمول بها في المملكة العربية السعودية.</p>

<h2>المادة السادسة — أحكام عامة</h2>
<p>يخضع هذا العقد لأنظمة المملكة العربية السعودية، وما لم يرد به نص فيه تُطبّق بشأنه الأنظمة واللوائح ذات العلاقة. يُعدّ التوقيع الإلكتروني على هذا العقد صحيحاً ومنتجاً لآثاره النظامية بموجب نظام التعاملات الإلكترونية.</p>

<table class="signatures">
  <tr>
    <th>الطرف الأول</th>
    <th>الطرف الثاني</th>
  </tr>
  <tr>
    <td>{{org.nameAr}}<br/>{{org.signerName}}<br/>{{org.signerTitle}}</td>
    <td>{{candidate.nameAr}}<br/><span class="sig-line">التوقيع الإلكتروني</span></td>
  </tr>
</table>
`.trim(),
};

export const CONFIDENTIALITY_AGREEMENT: DefaultTemplate = {
  type: "CONFIDENTIALITY_AGREEMENT",
  nameAr: "اتفاقية السرية",
  bodyHtml: `
<h1>{{contract.nameAr}}</h1>
<p class="meta">حُرّر بتاريخ {{contract.date}}</p>
<p>أُقرّ أنا <strong>{{candidate.nameAr}}</strong> (رقم الهوية {{candidate.nationalId}})، بصفتي موظفاً لدى <strong>{{org.officialNameAr}}</strong> في وظيفة {{candidate.jobTitle}}، بما يلي:</p>
<ol>
  <li>المحافظة التامة على سرية جميع المعلومات والبيانات والوثائق التي أطّلع عليها بحكم عملي.</li>
  <li>عدم نسخ أو نقل أو إفشاء أي معلومة سرية لأي طرف غير مخوّل، داخل الجهة أو خارجها.</li>
  <li>إعادة جميع الوثائق والأجهزة والوسائط عند انتهاء خدمتي أو عند طلب الجهة.</li>
  <li>استمرار هذا الالتزام بعد انتهاء علاقتي الوظيفية بالجهة.</li>
</ol>
<p>وأتحمّل كامل المسؤولية النظامية عن أي إخلال بهذا الإقرار.</p>
<table class="signatures">
  <tr><th>المُقرّ</th></tr>
  <tr><td>{{candidate.nameAr}}<br/><span class="sig-line">التوقيع الإلكتروني</span></td></tr>
</table>
`.trim(),
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  GOVERNMENT_EMPLOYMENT_CONTRACT,
  CONFIDENTIALITY_AGREEMENT,
];
