import { AuthLayout } from '../../components/auth/auth-layout';
import { PasswordResetForm } from '../../components/auth/password-reset-form';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <PasswordResetForm />
    </AuthLayout>
  );
}
