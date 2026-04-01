import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  PhotoIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const steps = [
  {
    title: 'Open role upgrade',
    description: 'Go to Settings, choose Captain Access or Field Owner Access, and open the payment form.',
    icon: ShieldCheckIcon
  },
  {
    title: 'Pay the exact fee',
    description: 'Scan the QR code, pay the full amount shown in the form, and wait until the transfer finishes.',
    icon: BanknotesIcon
  },
  {
    title: 'Fill payer details',
    description: 'Enter the payer account name and phone number that were used for the payment.',
    icon: DocumentTextIcon
  },
  {
    title: 'Add reference details',
    description: 'Write the bank or app name, transaction ID, payment date and time, and any useful reference note.',
    icon: DocumentTextIcon
  },
  {
    title: 'Upload screenshot',
    description: 'Upload a clear screenshot that shows the amount, date, and payment confirmation.',
    icon: PhotoIcon
  },
  {
    title: 'Submit and wait',
    description: 'Press Submit. Admin will check your payment and approve or reject the request.',
    icon: CheckCircleIcon
  }
];

const troubleshootingTips = [
  'Make sure the screenshot is clear and not cropped.',
  'Check that the paid amount matches the upgrade fee exactly.',
  'Use the same payer name and phone number that appear in the payment app.',
  'Add the transaction ID or a short note if you paid from another account.',
  'If your request is rejected, fix the payment details and submit a new request.'
];

const contacts = [
  {
    title: 'Call helper',
    value: '0713266899',
    href: 'tel:0713266899',
    icon: PhoneIcon,
    action: 'Call now'
  },
  {
    title: 'Email helper',
    value: 'phanphoun855@gmail.com',
    href: 'mailto:phanphoun855@gmail.com',
    icon: EnvelopeIcon,
    action: 'Send email'
  },
  {
    title: 'Telegram helper',
    value: '@phanphoun',
    href: 'https://t.me/phanphoun',
    icon: ChatBubbleLeftRightIcon,
    action: 'Open Telegram'
  }
];

const UpgradeRoleHelpPage = () => {
  return (
    <div className="bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#ffffff_35%,#ecfdf5_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[linear-gradient(135deg,#0f172a_0%,#14532d_100%)] px-6 py-8 text-white sm:px-8">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Upgrade Help
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              How to upgrade your role step by step
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
              Use this guide if you want to become a Captain or Field Owner and need help with the QR payment, screenshot upload, or review process.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/app/settings"
                className="inline-flex items-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Go to Settings
              </Link>
              <Link
                to="/"
                className="inline-flex items-center rounded-2xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Back to Home
              </Link>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_360px]">
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                <h2 className="text-xl font-semibold text-slate-900">Upgrade flow</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Follow these steps in order to avoid payment errors and speed up approval.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.title} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Step {index + 1}
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-slate-900">{step.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-5">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">If payment has a problem</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Review these points before you send the request again or contact the helper.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {troubleshootingTips.map((tip) => (
                    <div
                      key={tip}
                      className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3"
                    >
                      <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-none text-emerald-600" />
                      <p className="text-sm leading-6 text-slate-700">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">Need direct help?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Contact the helper if your payment keeps failing or you are not sure what to write in the form.
                </p>

                <div className="mt-5 space-y-4">
                  {contacts.map((contact) => {
                    const Icon = contact.icon;
                    return (
                      <div key={contact.title} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start gap-3">
                          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">{contact.title}</p>
                            <p className="mt-1 break-all text-sm text-slate-600">{contact.value}</p>
                            <a
                              href={contact.href}
                              target={contact.href.startsWith('http') ? '_blank' : undefined}
                              rel={contact.href.startsWith('http') ? 'noreferrer' : undefined}
                              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline underline-offset-4"
                            >
                              {contact.action}
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/70 p-5">
                <h2 className="text-lg font-semibold text-slate-900">What happens after you submit?</h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  If the payment is correct, the system will notify you that you are becoming the requested role. If the payment is rejected, you will see a payment failed alert and can submit a corrected request again.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default UpgradeRoleHelpPage;
