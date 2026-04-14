import { Letterhead, RefDateBlock, SignatoryBlock, VerificationLine } from './_shared/Letterhead';

export function InternshipCertificate() {
  return (
    <Letterhead>
      <RefDateBlock refNo="RL/CRT/2026/0015" date="14/04/2026" />

      <p className="text-center font-bold text-[14pt] tracking-[0.15em] text-gray-900 mb-8 uppercase">
        Internship Certificate
      </p>

      <div className="space-y-4 text-justify">
        <p>
          This is to certify that <strong>Ms. Ananya Rao</strong> worked as a{' '}
          <strong>UI/UX Design Intern</strong> in the <strong>Product Design</strong> department 
          at <strong>Rayomind Solutions LLP</strong> from <strong>01/06/2025</strong> to{' '}
          <strong>30/11/2025</strong>.
        </p>

        <p>
          During this period, Ms. Rao completed all assigned responsibilities satisfactorily 
          and demonstrated a commendable level of dedication and professionalism.
        </p>

        <p>
          We wish her all the best in her future academic and professional pursuits.
        </p>
      </div>

      <SignatoryBlock name="Priya Sharma" designation="Head of Human Resources" />
      <VerificationLine refNo="RL/CRT/2026/0015" authCode="F5B1-8C3D" />
    </Letterhead>
  );
}
