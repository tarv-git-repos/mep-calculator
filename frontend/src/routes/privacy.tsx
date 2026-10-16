import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, CheckCircle2 } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPolicy,
})

function PrivacyPolicy() {
  const navigate = useNavigate()
  const { acceptPrivacy } = useAuth()
  const [agreed, setAgreed] = useState(false)

  const handleAccept = async () => {
    if (!agreed) return
    await acceptPrivacy()
    navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        <div className="p-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            TARV END USER LICENSE AGREEMENT AND TERMS OF SERVICE
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
            Please read this legal agreement carefully before using Tarv Applications, Extensions, and Datasets.
          </p>
        </div>

        <div className="p-8 prose prose-slate dark:prose-invert max-w-none h-[480px] overflow-y-auto custom-scrollbar text-sm text-slate-700 dark:text-slate-300">
          <p className="text-xs uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400 mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl">
            IMPORTANT: PLEASE READ THIS AGREEMENT CAREFULLY BEFORE ACCESSING, DOWNLOADING, INSTALLING, OR USING THIS APPLICATION.
          </p>

          <p className="mb-6 leading-relaxed">
            This End User License Agreement and Terms of Service ("Agreement") is a legally binding contract between you (either an individual or a single legal entity, hereinafter referred to as "User," "you," or "your") and Tarv ("Company," "Tarv," "we," "us," or "our"), governing your access to and use of Tarv’s software applications, mobile apps, desktop apps, web platforms, browser extensions, add-ins, plugins, proprietary datasets, and associated documentation (collectively, the "Application").
          </p>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">1. Electronic Assent and Enforceability</h3>
          <p className="leading-relaxed mb-2">By clicking the designated checkbox, checking "I Agree," downloading, installing, accessing, or utilizing any component of the Application, you expressly acknowledge, agree, and confirm that:</p>
          <ul className="list-disc pl-5 space-y-1 mb-4">
            <li>You have read, understood, and consented to be bound by all terms, conditions, warranties, and obligations set forth in this Agreement.</li>
            <li>By clicking on the checkbox, you are executing and signing this document electronically.</li>
            <li>This electronic act constitutes a valid, binding, and enforceable legal signature with the same legal force, validity, and effect as a handwritten physical signature.</li>
            <li>This document does not require any separate physical signature, wet-ink signature, or independent digital/e-signature verification workflow to be considered fully operational, authentic, and legally binding under all applicable electronic transaction and contract laws.</li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">2. Proprietary Rights and Absolute Ownership</h3>
          <p className="leading-relaxed mb-2">
            The Application, including all related source code, object code, software architecture, user interfaces (UI), user experience (UX) design, graphic assets, visual layouts, frontend elements, backend infrastructure, algorithms, database schemas, proprietary workflows, documentation, and all related add-ins or plugins, constitutes the valuable proprietary intellectual property of Tarv.
          </p>
          <p className="leading-relaxed mb-4">
            Tarv retains exclusive, worldwide ownership of all copyrights, patents, trade secrets, trademarks, moral rights, and all other proprietary rights in and to the Application and all associated company data. Nothing in this Agreement grants you any title, ownership, or transfer of intellectual property rights. You are granted only a limited, non-exclusive, non-transferable, revocable license to operate the Application solely for its intended purpose.
          </p>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">3. Absolute Prohibition Against Replication and Reverse Engineering</h3>
          <p className="leading-relaxed mb-2">
            You acknowledge and agree that the proprietary methods, frontend visuals, logic, workflows, and internal architectures of the Application represent confidential trade secrets and protected copyright works of Tarv.
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li><strong>Strict Prohibition on Replication:</strong> Under no circumstances shall any individual, entity, employee, contractor, or affiliated third party replicate, duplicate, reproduce, clone, emulate, copy, or recreate the logic, algorithms, inner workings, operational architecture, system structure, or frontend user interface of Tarv's app(s), software modules, or add-in(s), whether in whole or in part.</li>
            <li><strong>Prohibited Modifications and Derivative Works:</strong> You shall not decompile, reverse engineer, disassemble, decrypt, extract, translate, adapt, modify, create derivative works from, or attempt to derive the source code or underlying ideas of the Application or any component thereof.</li>
            <li><strong>Competitive Analysis:</strong> You shall not access or use the Application for benchmarking, competitive analysis, or to build a competing product, service, software feature, add-in, or workflow automation tool.</li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">4. Material Breach, Admission of Liability, and Liquidated Damages</h3>
          <p className="leading-relaxed mb-2">
            Because unauthorized copying, emulation, or derivation of Tarv’s proprietary technology causes immediate, irreparable harm that is difficult to quantify precisely:
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li><strong>Admission of Wrongful Conduct:</strong> If Tarv discovers, identifies, or reasonably determines that you (or any party acting on your behalf, under your direction, or utilizing your access credentials) have replicated, cloned, reverse engineered, or reproduced any aspect, component, workflow, logic, interface, or feature of Tarv's product—whether fully or partially—you expressly acknowledge, admit, and agree that you have engaged in unlawful conduct, willful breach of contract, and intentional copyright and trade secret infringement.</li>
            <li><strong>Agreed Liquidated Damages ($1,000,000 USD):</strong> You explicitly agree that in the event of any such replication, duplication, reverse engineering, or unauthorized reproduction (full or partial), you shall be immediately and unconditionally liable to pay Tarv liquidated damages in the amount of $1,000,000 USD (One Million United States Dollars).</li>
            <li><strong>Additional Legal Remedies:</strong> The assessment and collection of the agreed $1,000,000 USD liquidated damages shall not limit Tarv’s right to pursue additional legal, equitable, injunctive, or punitive remedies, including preliminary or permanent restraining orders, seizure of infringing materials, recovery of actual damages exceeding this threshold, and reimbursement for all incurred legal costs, expert witness fees, and reasonable attorney fees.</li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">5. Data Collection, Usage Scope, and Local AI Training</h3>
          <p className="leading-relaxed mb-2">
            Tarv respects user privacy and limits its data collection practices strictly to operational efficiency and functionality enhancement:
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li><strong>Scope of Data Collected:</strong> Tarv collects and processes only the user’s operational workflow data (interaction patterns, feature utilization, execution sequences) and geographic location data.</li>
            <li><strong>Exclusive Purpose of Processing:</strong> The workflow data and location data collected are utilized solely to train and optimize a local Artificial Intelligence (AI) agent integrated directly with the Application to streamline user tasks and context-aware execution.</li>
            <li><strong>Data Protection:</strong> Tarv does not sell, lease, monetize, or distribute your workflow or location data to external third-party advertisers or unassociated commercial data brokers.</li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">6. Disclaimer of Warranties and Limitation of Liability</h3>
          <p className="leading-relaxed mb-2">
            The Application is provided strictly on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, non-infringement, or error-free operation.
          </p>
          <p className="leading-relaxed mb-4">
            To the maximum extent permitted by applicable law, Tarv and its directors, officers, employees, agents, and licensors shall not be held liable for any indirect, incidental, special, consequential, or punitive damages, including loss of business profits, data corruption, operational disruption, or system downtime arising out of or related to your use of or inability to use the Application.
          </p>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">7. Termination</h3>
          <p className="leading-relaxed mb-4">
            This Agreement remains in full effect until terminated. Tarv reserves the absolute right to suspend, restrict, or terminate your license and access to the Application immediately, without prior notice or refund, upon any suspected breach of this Agreement. Upon termination, you must immediately cease all access, delete, and permanently destroy all copies of the Application and associated add-ins in your possession. Sections 2, 3, 4, 6, 8, and 9 shall survive any termination of this Agreement.
          </p>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">8. Governing Law and Jurisdiction</h3>
          <p className="leading-relaxed mb-4">
            This Agreement shall be governed by, interpreted, and construed in accordance with the substantive laws applicable to commercial software agreements, without giving effect to any principles of conflicts of law. Any dispute, claim, litigation, or legal proceeding arising out of or in connection with this Agreement, including claims related to intellectual property infringement or liquidated damages, shall be submitted to the exclusive jurisdiction of the competent commercial courts designated by Tarv.
          </p>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-2">9. Severability and Entire Agreement</h3>
          <p className="leading-relaxed mb-4">
            If any provision of this Agreement is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, such provision shall be enforced to the maximum extent permissible, and the remaining provisions shall remain in full force and effect. This Agreement constitutes the complete and exclusive understanding between you and Tarv regarding the Application and supersedes all prior proposals, understandings, or agreements, whether oral or written.
          </p>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-normal">
              I HAVE READ, UNDERSTOOD, AND AGREE TO ALL TERMS OF THIS AGREEMENT. I EXPRESSLY ACKNOWLEDGE THAT CHECKING THIS BOX CONSTITUTES MY LEGAL ELECTRONIC SIGNATURE AND BINDS ME TO ALL COVENANTS, IP PROTECTIONS, AND LIQUIDATED DAMAGES PROVISIONS STATED HEREIN.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              By checking the box above and clicking "I Accept & Continue", you execute your binding legal electronic signature.
            </p>
            <button
              onClick={handleAccept}
              disabled={!agreed}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 font-bold rounded-xl transition-all shadow-md shrink-0 ${
                agreed
                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer hover:shadow-lg"
                  : "bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              I Accept & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
