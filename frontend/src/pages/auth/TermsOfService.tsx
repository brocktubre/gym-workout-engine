import { PageHeader } from '@/components/layout/PageHeader';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PageHeader title="Terms of Service" showBack />

      <div className="px-4 pb-8 space-y-5 text-sm text-[#C7C7CC] leading-relaxed">
        <p className="text-xs text-[#8E8E93]">Last updated: August 4, 2026</p>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Acceptance of Terms</h2>
          <p>
            By creating an account or using Gym Workout Engine (the "Service"), you agree to be
            bound by these Terms of Service. If you do not agree, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Health & Fitness Disclaimer</h2>
          <p>
            Gym Workout Engine is a fitness planning tool and provides general workout suggestions.
            It is <span className="text-white font-semibold">not medical advice</span> and is not a
            substitute for professional guidance from a physician, physical therapist, or certified
            trainer. Consult a qualified professional before beginning any new exercise regimen,
            particularly if you have pre-existing conditions or injuries. You use this Service at
            your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Account Responsibility</h2>
          <p>
            You are responsible for keeping your login credentials secure and for all activity
            that occurs under your account. Notify us immediately of any unauthorized use.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Acceptable Use</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Do not attempt to disrupt, reverse-engineer, or exploit the Service.</li>
            <li>Do not use the Service for any unlawful purpose.</li>
            <li>Do not share your account or misrepresent your identity.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">No Warranty</h2>
          <p>
            The Service is provided "as is" and "as available", without warranty of any kind, either
            express or implied. We do not guarantee that the Service will be error-free, uninterrupted,
            or free from harmful components.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Gym Workout Engine and its operators shall not
            be liable for any indirect, incidental, special, consequential, or punitive damages —
            including physical injury — arising out of or related to your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Termination</h2>
          <p>
            You may terminate your account at any time. We reserve the right to suspend or terminate
            accounts that violate these terms or engage in abuse of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the Service after changes
            take effect constitutes acceptance of the revised terms.
          </p>
        </section>
      </div>
    </div>
  );
}
