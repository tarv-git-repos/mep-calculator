import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, CheckCircle2 } from 'lucide-react'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPolicy,
})

function PrivacyPolicy() {
  const navigate = useNavigate()

  const handleAccept = () => {
    localStorage.setItem('mep-privacy-accepted', 'true')
    navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        <div className="p-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Privacy Policy & Terms of Service
          </h1>
          <p className="mt-4 text-slate-500 dark:text-slate-400 text-lg">
            Please review our end-user license agreement before using the MEP Calculator suite.
          </p>
        </div>

        <div className="p-8 prose prose-slate dark:prose-invert max-w-none h-[400px] overflow-y-auto custom-scrollbar">
          <h3>1. Acceptance of Terms</h3>
          <p>By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.</p>
          
          <h3>2. Data Storage & Telemetry</h3>
          <p>This application operates both locally on your device and via our secure cloud servers. Project calculations are auto-saved to your local AppData folder to prevent data loss. If you are signed in, your projects are synced securely to our cloud database to enable Real-Time Collaboration and Auto-Locking features.</p>
          
          <h3>3. Licensing</h3>
          <p>Your license is bound strictly to your registered email address. Sharing accounts or bypassing the license verification mechanisms is strictly prohibited and will result in permanent account suspension.</p>
          
          <h3>4. Auto-Updates</h3>
          <p>The desktop version of this application periodically checks for updates to ensure you have the latest calculators, bug fixes, and security patches. By accepting these terms, you consent to these automatic background checks.</p>
          
          <h3>5. Disclaimer of Liability</h3>
          <p>The calculations provided by this software are for preliminary design and estimation purposes only. The authors and developers of this software are not liable for any structural, mechanical, or electrical failures that may occur based on these estimations. Always verify critical engineering data with certified local codes and professional engineers.</p>
          
          <br/>
          <br/>
          <br/>
          <br/>
          <br/>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
            By clicking "I Accept", you acknowledge that you have read, understood, and agree to our terms.
          </p>
          <button
            onClick={handleAccept}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shrink-0"
          >
            <CheckCircle2 className="w-5 h-5" />
            I Accept & Continue
          </button>
        </div>
      </div>
    </div>
  )
}
