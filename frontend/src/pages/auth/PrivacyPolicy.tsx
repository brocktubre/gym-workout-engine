import { PageHeader } from '@/components/layout/PageHeader';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PageHeader title="Privacy Policy" showBack />

      <div className="px-4 pb-8 space-y-5 text-sm text-[#C7C7CC] leading-relaxed">
        <p className="text-xs text-[#8E8E93]">Last updated: August 4, 2026</p>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Overview</h2>
          <p>
            Gym Workout Engine ("we", "the app") respects your privacy. This policy describes what
            information we collect, how we use it, and the choices you have.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><span className="text-white font-medium">Account information</span>: email address and a securely hashed password (managed by AWS Cognito).</li>
            <li><span className="text-white font-medium">Workout data</span>: workouts you generate, complete, and track (exercises, sets, weights, reps, duration).</li>
            <li><span className="text-white font-medium">Preferences</span>: your equipment, goals, fitness level, and other training settings.</li>
            <li><span className="text-white font-medium">Local storage</span>: in-progress workout state and cached preferences stored on your device for offline continuity.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">How We Use Your Information</h2>
          <p>
            We use your data solely to generate personalized workouts, sync progress across your
            devices, and improve your experience within the app. We do not sell or share your
            personal data with advertisers or unrelated third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Third-Party Services</h2>
          <p>
            We rely on <span className="text-white font-medium">AWS Cognito</span> for authentication
            and identity management, and Amazon Web Services (DynamoDB, Lambda) for hosting and data
            storage. Your data is processed subject to AWS's privacy commitments.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Your Rights</h2>
          <p>
            You may access, update, or delete your account at any time from the Settings screen.
            Deleting your account permanently removes your profile and workout history.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Security</h2>
          <p>
            Communications between the app and our servers use HTTPS. Passwords are never stored in
            plain text. Sessions use short-lived, revocable tokens.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Contact</h2>
          <p>
            Questions about this policy? Contact us at{' '}
            <span className="text-[#FF375F]">support@gym-workout-engine.example</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
