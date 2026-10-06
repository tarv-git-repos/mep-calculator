const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/components/workspace/CalculationReviewBar.tsx';
let content = fs.readFileSync(file, 'utf8');

const bannerComponent = `
export function CalculationStatusBanner({ projectId, calculatorPath }: { projectId?: string, calculatorPath: string }) {
  const reviewState = useCalculationReviewState(calculatorPath, projectId);
  
  if (!reviewState || reviewState.status === 'DRAFT') return null;
  
  const isApproved = reviewState.status === 'APPROVED';
  const isReviewed = reviewState.status === 'REVIEWED';
  const isRejected = reviewState.status === 'REJECTED';
  
  const bgColor = isApproved ? 'bg-green-500/20' : isReviewed ? 'bg-blue-500/20' : isRejected ? 'bg-red-500/20' : 'bg-[#333]';
  const borderColor = isApproved ? 'border-green-500/30' : isReviewed ? 'border-blue-500/30' : isRejected ? 'border-red-500/30' : 'border-[#444]';
  const textColor = isApproved ? 'text-green-400' : isReviewed ? 'text-blue-400' : isRejected ? 'text-red-400' : 'text-gray-300';
  
  return (
    <div className={\`w-full px-4 py-2 flex items-center justify-between border-b \${bgColor} \${borderColor}\`}>
      <div className="flex items-center gap-3">
        {isApproved && <CheckCircle2 className={\`size-5 \${textColor}\`} />}
        {isReviewed && <ShieldCheck className={\`size-5 \${textColor}\`} />}
        {isRejected && <XCircle className={\`size-5 \${textColor}\`} />}
        <div>
          <div className={\`text-sm font-medium \${textColor}\`}>
            {isApproved ? 'Calculation Approved' : isReviewed ? 'Calculation Reviewed' : isRejected ? 'Calculation Rejected' : 'Draft'}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {isApproved ? \`Approved by \${reviewState.approvedBy || 'Unknown'}\` : 
             isReviewed ? \`Reviewed by \${reviewState.reviewedBy || 'Unknown'}\` : 
             isRejected ? \`Rejected by \${reviewState.rejectedBy || 'Unknown'}\` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
`;

content += '\n' + bannerComponent;
fs.writeFileSync(file, content, 'utf8');
console.log("Added CalculationStatusBanner to CalculationReviewBar.tsx");
